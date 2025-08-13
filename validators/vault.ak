//// This holds the assets submitted by users

use aiken/collection/list
use cardano/address.{Script}
use cardano/transaction.{OutputReference, Transaction}
use helpers.{get_cfg, is_pool_utxo, is_request_utxo}
use types.{
  LiveShuffle, ProtocolParams, ReShuffle, SettingsDatum, SpendBadUtxo,
  UnifiedRedeemer,
}

validator vault(params: ProtocolParams) {
  spend(
    _datum: Option<Data>,
    redeemer: UnifiedRedeemer,
    out_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      LiveShuffle { protocol_idxs, vault_idxs, settings_idx, .. } -> {
        // make sure the only vault input spent is the one in the redeemer
        let vault_input_valid =
          is_request_utxo(out_ref, tx.inputs, vault_idxs.1st)
        // get config settings
        let cfg = get_cfg(tx.reference_inputs, settings_idx, params.cfg_policy)
        expect Some(protocol_input) = list.at(tx.inputs, protocol_idxs.1st)
        let has_protocol_input =
          Script(cfg.protocol) == protocol_input.output.address.payment_credential
        and {
          vault_input_valid?,
          has_protocol_input?,
        }
      }

      ReShuffle { protocol_idxs, settings_idx, request_idx, pool_idxs, .. } -> {
        // get config settings
        let cfg = get_cfg(tx.reference_inputs, settings_idx, params.cfg_policy)
        expect Some(protocol_input) = list.at(tx.inputs, protocol_idxs.1st)
        let has_protocol_input =
          Script(cfg.protocol) == protocol_input.output.address.payment_credential

        // make sure vault contract utxos spent are only the ones in the redeemer
        let vault_input_valid = or {
            is_request_utxo(out_ref, tx.inputs, request_idx),
            is_pool_utxo(out_ref, tx.inputs, pool_idxs),
          }

        and {
          has_protocol_input?,
          vault_input_valid?,
        }
      }

      SpendBadUtxo { protocol_idxs, settings_idx, .. } -> {
        let cfg = get_cfg(tx.reference_inputs, settings_idx, params.cfg_policy)
        expect Some(protocol_input) = list.at(tx.inputs, protocol_idxs.1st)
        let has_protocol_input =
          Script(cfg.protocol) == protocol_input.output.address.payment_credential
        has_protocol_input?
      }
      _ -> fail @"Invalid redeemer for vault::spend"
    }
  }

  else(_) {
    fail @"Unsupported tx purpose for vault validator"
  }
}
