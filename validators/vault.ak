//// This holds the assets submitted by users

use aiken/collection/list
use aiken/collection/pairs
use cardano/address.{Credential, Script}
use cardano/script_context.{ScriptContext}
use cardano/transaction.{OutputReference, Transaction, find_input}
use helpers.{get_cfg}
use types.{
  LiveShuffle, ProtocolParams, ReShuffle, SettingsDatum, UnifiedRedeemer,
  VaultDatum,
}
use utils.{find_script_input, is_signed_by}

validator vault(params: ProtocolParams) {
  spend(
    _datum: Option<Data>,
    redeemer: UnifiedRedeemer,
    out_ref: OutputReference,
    this_tx: Transaction,
  ) {
    when redeemer is {
      LiveShuffle { protocol_idxs, settings_idx } |
      ReShuffle { protocol_idxs, settings_idx } -> {
        let cfg =
          get_cfg(
            this_tx.reference_inputs,
            settings_idx,
            params.settings_policy,
          )
        expect Some(protocol_input) = list.at(this_tx.inputs, protocol_idxs.1st)
        let has_protocol_input =
          Script(cfg.protocol) == protocol_input.output.address.payment_credential
        has_protocol_input?
      }
      SpendBadUtxo { bad_utxo_idx, gcfg_utxo_idx } -> {
        expect Some(input) = list.at(tx.inputs, bad_utxo_idx)
        expect out_ref == input.output_reference
        let cfg = get_cfg(tx.reference_inputs, gcfg_utxo_idx, params.cfg_policy)
        is_signed_by(tx.extra_signatories, cfg.admin)
      }
      _ -> fail @"Invalid redeemer for vault::spend"
    }
  }

  else(_) {
    fail @"Unsupported tx purpose for vault validator"
  }
}
