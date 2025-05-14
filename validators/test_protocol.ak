use cardano/transaction.{NoDatum, Output, Transaction, placeholder}
use protocol
use test_constants as tc
use types.{CancelShuffle, LiveShuffle, ReShuffle}

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

test re_shuffle_succeed() {
  let vault_output_pool =
    Output {
      address: tc.vault_script_address,
      value: tc.vault_output_request.value,
      datum: NoDatum,
      reference_script: None,
    }
  let user_reshuffle_output =
    Output {
      address: tc.user_address,
      value: tc.vault_output_pool.value,
      datum: NoDatum,
      reference_script: None,
    }
  let this_tx =
    Transaction {
      ..placeholder,
      inputs: [
        tc.settings_input,
        tc.vault_input_request,
        tc.vault_input_pool,
        tc.protocol_input,
      ],
      outputs: [
        tc.settings_output,
        vault_output_pool,
        tc.protocol_output,
        user_reshuffle_output,
      ],
    }
  let redeemer = ReShuffle
  protocol.protocol.spend(
    tc.protocol_params,
    None,
    redeemer,
    tc.protocol_output_ref,
    this_tx,
  )
}

test cancel_shuffle_succeed() {
  let user_cancel_output =
    Output {
      address: tc.user_address,
      value: tc.vault_output_request.value,
      datum: NoDatum,
      reference_script: None,
    }
  let this_tx =
    Transaction {
      ..placeholder,
      inputs: [tc.settings_input, tc.protocol_input, tc.vault_input_request],
      outputs: [tc.settings_output, tc.protocol_output, user_cancel_output],
      extra_signatories: [tc.user_payment_keyhash],
    }
  let redeemer = CancelShuffle
  protocol.protocol.spend(
    tc.protocol_params,
    None,
    redeemer,
    tc.protocol_output_ref,
    this_tx,
  )
}
