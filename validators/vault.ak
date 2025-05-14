//// This holds the assets submitted by users

use aiken/collection/pairs
use cardano/address.{Credential}
use cardano/script_context.{ScriptContext}
use cardano/transaction.{OutputReference, Transaction, find_input}
use helpers.{get_settings}
use types.{SettingsDatum, UnifiedRedeemer, VaultDatum, VaultParams}
use utils.{find_script_input, is_signed_by}

validator vault(params: VaultParams) {
  spend(
    _datum: Option<VaultDatum>,
    _redeemer: UnifiedRedeemer,
    output_ref: OutputReference,
    this_tx: Transaction,
  ) {
    // Pass main validation to the "withdraw" purpose of this validator
    // to reduce execution cost when spending multiple UTXOs.
    expect Some(input_from_self) = find_input(this_tx.inputs, output_ref)
    let withdrawals = this_tx.withdrawals
    let this_acct = input_from_self.output.address.payment_credential
    pairs.has_key(withdrawals, this_acct)?
  }

  withdraw(
    _redeemer: UnifiedRedeemer,
    _account: Credential,
    this_tx: Transaction,
  ) {
    let settings =
      get_settings(
        this_tx.inputs,
        params.settings_policy,
        params.beacon_asset_name,
      )
    let protocol_input_maybe =
      find_script_input(this_tx.inputs, settings.protocol)
    let protocol_input_present =
      when protocol_input_maybe is {
        Some(_) -> True
        None -> False
      }
    protocol_input_present?
  }

  else(context: ScriptContext) {
    let this_tx: Transaction = context.transaction
    is_signed_by(this_tx.extra_signatories, params.admin)
  }
}
