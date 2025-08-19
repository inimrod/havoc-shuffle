//// This holds the assets submitted by users

use aiken/collection/list
use cardano/address.{Script}
use cardano/transaction.{OutputReference, Transaction}
use helpers.{get_cfg}
use types.{
  CancelShuffle, LiveShuffle, ProtocolParams, ReShuffle, SettingsDatum,
  SpendBadUtxo, UnifiedRedeemer,
}

validator vault(params: ProtocolParams) {
  spend(
    _datum: Option<Data>,
    redeemer: UnifiedRedeemer,
    _out_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      LiveShuffle { protocol_idxs, settings_idx, .. } |
      ReShuffle { protocol_idxs, settings_idx, .. } |
      CancelShuffle { protocol_idxs, settings_idx, .. } |
      SpendBadUtxo { protocol_idxs, settings_idx, .. } -> {
        // get config settings
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
