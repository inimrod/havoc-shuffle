//// Minting policy for the beacon token marking the UTXO with the datum
//// containing the settings for the protocol -- mainly the latest hash of
//// the upgradeable validator.

use aiken/collection/list
use cardano/address.{Script}
use cardano/assets.{PolicyId, quantity_of}
use cardano/transaction.{OutputReference, Transaction}
use constants.{global_cfg_token as cfg_token}
use helpers.{get_cfg, get_global_settings_from_input, is_cfg_utxo_returned}
use types.{
  BurnSettingsBeacon, MintSettingsBeacon, SettingsDatum, SpendBadUtxo,
  UnifiedRedeemer, UpdateSettings,
}
use utils.{is_signed_by}

validator settings(init_output_ref: OutputReference) {
  mint(redeemer: UnifiedRedeemer, this_policy: PolicyId, this_tx: Transaction) {
    let Transaction { inputs, mint, extra_signatories, .. } = this_tx
    when redeemer is {
      MintSettingsBeacon { init_utxo_idx } -> {
        let init_utxo_in_inputs =
          when list.at(inputs, init_utxo_idx) is {
            Some(input) -> input.output_reference == init_output_ref
            _ -> fail @"Init utxo not found in tx inputs"
          }
        let beacon_token_minted = 1 == quantity_of(mint, this_policy, cfg_token)
        and {
          init_utxo_in_inputs?,
          beacon_token_minted?,
        }
      }
      BurnSettingsBeacon { gcfg_utxo_idx } -> {
        expect Some(cfg_input) = list.at(inputs, gcfg_utxo_idx)
        expect
          Script(this_policy) == cfg_input.output.address.payment_credential
        let cfg = get_global_settings_from_input(cfg_input)
        let beacon_token_burned =
          -1 == quantity_of(mint, this_policy, cfg_token)
        let signed_by_admin = is_signed_by(extra_signatories, cfg.admin)
        and {
          beacon_token_burned?,
          signed_by_admin?,
        }
      }
      _ -> fail @"Invalid redeemer for settings::mint"
    }
  }

  spend(
    _datum: Option<Data>,
    redeemer: UnifiedRedeemer,
    out_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      UpdateSettings { input_idx, output_idx } -> {
        expect Some(input) = list.at(tx.inputs, input_idx)
        expect Some(output) = list.at(tx.outputs, output_idx)
        expect out_ref == input.output_reference
        expect Script(cfg_policy) = input.output.address.payment_credential
        let cfg = get_global_settings_from_input(input)
        let has_global_cfg_token =
          1 == quantity_of(input.output.value, cfg_policy, cfg_token)
        let cfg_utxo_returned = is_cfg_utxo_returned(input, output)
        let signed_by_admin = is_signed_by(tx.extra_signatories, cfg.admin)
        and {
          has_global_cfg_token?,
          cfg_utxo_returned?,
          signed_by_admin?,
        }
      }
      BurnSettingsBeacon { gcfg_utxo_idx } -> {
        expect Some(input) = list.at(tx.inputs, gcfg_utxo_idx)
        expect out_ref == input.output_reference
        expect Script(this_policy) = input.output.address.payment_credential
        let beacon_token_burned =
          -1 == quantity_of(tx.mint, this_policy, cfg_token)
        beacon_token_burned?
      }
      SpendBadUtxo { bad_utxo_idx, settings_idx, .. } -> {
        expect Some(input) = list.at(tx.inputs, bad_utxo_idx)
        expect out_ref == input.output_reference
        expect Script(this_policy) = input.output.address.payment_credential
        let no_global_cfg_token =
          0 == quantity_of(input.output.value, this_policy, cfg_token)
        let cfg = get_cfg(tx.reference_inputs, settings_idx, this_policy)
        let signed_by_admin = is_signed_by(tx.extra_signatories, cfg.admin)

        and {
          no_global_cfg_token?,
          signed_by_admin?,
        }
      }
      _ -> fail @"Invalid redeemer for settings::spend"
    }
  }

  else(_) {
    fail @"Unsupported purpose for settings validator"
  }
}
