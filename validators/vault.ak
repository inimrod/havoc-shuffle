//// This holds the assets submitted by users

use cardano/assets.{quantity_of}
use cardano/script_context.{ScriptContext}
use cardano/transaction.{InlineDatum, OutputReference, Transaction}
use types.{SettingsDatum, UnifiedRedeemer, VaultDatum, VaultParams}
use utils.{find_script_input, is_signed_by}

validator vault(params: VaultParams) {
  spend(
    _datum: Option<VaultDatum>,
    _redeemer: UnifiedRedeemer,
    _output_ref: OutputReference,
    this_tx: Transaction,
  ) {
    expect Some(settings_input) =
      find_script_input(this_tx.inputs, params.settings_policy)
    expect
      1 == quantity_of(
        settings_input.output.value,
        params.settings_policy,
        params.beacon_asset_name,
      )
    expect InlineDatum(settings_datum) = settings_input.output.datum
    expect settings: SettingsDatum = settings_datum
    let protocol_input_maybe =
      find_script_input(this_tx.inputs, settings.protocol)
    when protocol_input_maybe is {
      Some(_) -> True
      None -> False
    }
  }

  else(context: ScriptContext) {
    let this_tx: Transaction = context.transaction
    is_signed_by(this_tx.extra_signatories, params.admin)
  }
}
