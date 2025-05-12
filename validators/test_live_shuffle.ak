use cardano/transaction.{Transaction, placeholder}
use protocol
use test_constants as tc
use types.{LiveShuffle}

test live_shuffle_succeed() {
  let this_tx =
    Transaction {
      ..placeholder,
      mint: tc.hw_s2_1042_value,
      inputs: [
        tc.settings_input,
        tc.vault_input_request,
        tc.protocol_input,
        tc.user_liveshuffle_input,
      ],
      outputs: [
        tc.settings_output,
        tc.vault_output_pool,
        tc.protocol_output,
        tc.user_liveshuffle_output,
      ],
    }
  let redeemer = LiveShuffle
  protocol.protocol.spend(
    tc.protocol_params,
    None,
    redeemer,
    tc.protocol_output_ref,
    this_tx,
  )
}
