//// This contains the main validator business logic

use cardano/script_context.{ScriptContext}
use cardano/transaction.{OutputReference, Transaction}
use helpers.{get_settings, validate_protocol_output}
use types.{
  Administer, CancelShuffle, LiveShuffle, ProtocolParams, ReShuffle,
  UnifiedRedeemer,
}
use utils.{is_signed_by}

validator protocol(params: ProtocolParams) {
  spend(
    _datum: Option<Data>,
    redeemer: UnifiedRedeemer,
    output_ref: OutputReference,
    this_tx: Transaction,
  ) {
    when redeemer is {
      LiveShuffle -> {
        let settings =
          get_settings(
            this_tx.inputs,
            params.settings_policy,
            params.beacon_asset_name,
          )
        let protocol_output_valid =
          validate_protocol_output(this_tx, output_ref, settings)
        and {
          protocol_output_valid,
          True,
        }
      }
      ReShuffle -> todo @"ReShuffle logic"
      CancelShuffle -> todo @"CancelShuffle logic"
      Administer -> is_signed_by(this_tx.extra_signatories, params.admin)
      _ -> fail @"Invalid redeemer for protocol::spend"
    }
  }

  else(context: ScriptContext) {
    let this_tx: Transaction = context.transaction
    is_signed_by(this_tx.extra_signatories, params.admin)
  }
}
