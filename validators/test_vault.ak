use cardano/transaction.{Transaction, placeholder}
use test_constants as tc
use types.{LiveShuffle}
use vault

test vault_spend_succeed() {
  let withdrawal =
    Pair(tc.vault_input_request.output.address.payment_credential, 0)
  let this_tx =
    Transaction {
      ..placeholder,
      inputs: [tc.vault_input_request, tc.vault_input_pool],
      outputs: [],
      withdrawals: [withdrawal],
    }
  let redeemer = LiveShuffle
  vault.vault.spend(
    tc.vault_params,
    None,
    redeemer,
    tc.vault_output_pool_ref,
    this_tx,
  )
}

test vault_withdraw_succeed() {
  let credential = tc.vault_input_request.output.address.payment_credential
  let this_tx =
    Transaction {
      ..placeholder,
      inputs: [
        tc.settings_input,
        tc.protocol_input,
        tc.vault_input_request,
        tc.vault_input_pool,
      ],
      outputs: [],
    }
  let redeemer = LiveShuffle
  vault.vault.withdraw(tc.vault_params, redeemer, credential, this_tx)
}
