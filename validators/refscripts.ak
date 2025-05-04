//// This holds the UTXOs containing the compiled validators as reference scripts

use aiken/collection/pairs
use aiken/crypto.{VerificationKeyHash}
use cardano/script_context.{ScriptContext}
use cardano/transaction.{OutputReference, Transaction, find_input}
use utils.{is_signed_by}

validator refscripts(admin: VerificationKeyHash) {
  spend(_datum, _redeemer, output_ref: OutputReference, this_tx: Transaction) {
    expect Some(input_from_self) = find_input(this_tx.inputs, output_ref)
    let withdrawals = this_tx.withdrawals
    let own_withdrawal = input_from_self.output.address.payment_credential
    pairs.has_key(withdrawals, own_withdrawal)
  }

  else(context: ScriptContext) {
    let this_tx: Transaction = context.transaction
    is_signed_by(this_tx.extra_signatories, admin)
  }
}
