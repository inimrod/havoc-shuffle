use cardano/assets.{from_asset, merge, zero}
use cardano/transaction.{NoDatum, Output, Transaction, placeholder}
use protocol
use test_constants as tc
use types.{CancelShuffle, LiveShuffle, ReShuffle}

test live_shuffle_succeed() {
  // HW S2 1069 Ref
  // HW S2 1069 Usr
  // HW S2 0069 Ref
  // HW S2 0069 Usr
  let mint_value =
    zero
      |> merge(from_asset(tc.s2_policy_id, #"000643b048572053322031303639", 1))
      |> merge(from_asset(tc.s2_policy_id, #"000de14048572053322031303639", 1))
      |> merge(from_asset(tc.s2_policy_id, #"000643b048572053322030303639", 1))
      |> merge(from_asset(tc.s2_policy_id, #"000de14048572053322030303639", 1))
  let this_tx =
    Transaction {
      ..placeholder,
      mint: mint_value,
      inputs: [tc.vault_input_request, tc.protocol_input],
      outputs: [
        tc.vault_output_pool,
        tc.protocol_output,
        tc.user_liveshuffle_output_from_mint,
        tc.cip68_reftoken1_output,
        tc.cip68_reftoken2_output,
      ],
      reference_inputs: [tc.settings_input],
    }
  let redeemer =
    LiveShuffle {
      protocol_idxs: (1, 1),
      vault_idxs: (0, 0),
      user_idx: 2,
      ref_idxs: [3, 4],
      settings_idx: 0,
    }
  protocol.protocol.spend(
    tc.protocol_params,
    None,
    redeemer,
    tc.protocol_output_ref,
    this_tx,
  )
}
// test re_shuffle_succeed() {
//   let vault_output_pool =
//     Output {
//       address: tc.vault_script_address,
//       value: tc.vault_output_request.value,
//       datum: NoDatum,
//       reference_script: None,
//     }
//   let user_reshuffle_output =
//     Output {
//       address: tc.user_address,
//       value: tc.vault_output_pool.value,
//       datum: NoDatum,
//       reference_script: None,
//     }
//   let this_tx =
//     Transaction {
//       ..placeholder,
//       inputs: [
//         tc.settings_input,
//         tc.vault_input_request,
//         tc.vault_input_pool,
//         tc.protocol_input,
//       ],
//       outputs: [
//         tc.settings_output,
//         vault_output_pool,
//         tc.protocol_output,
//         user_reshuffle_output,
//       ],
//     }
//   let redeemer = ReShuffle
//   protocol.protocol.spend(
//     tc.protocol_params,
//     None,
//     redeemer,
//     tc.protocol_output_ref,
//     this_tx,
//   )
// }

// test cancel_shuffle_succeed() {
//   let user_cancel_output =
//     Output {
//       address: tc.user_address,
//       value: tc.vault_output_request.value,
//       datum: NoDatum,
//       reference_script: None,
//     }
//   let this_tx =
//     Transaction {
//       ..placeholder,
//       inputs: [tc.settings_input, tc.protocol_input, tc.vault_input_request],
//       outputs: [tc.settings_output, tc.protocol_output, user_cancel_output],
//       extra_signatories: [tc.user_payment_keyhash],
//     }
//   let redeemer = CancelShuffle
//   protocol.protocol.spend(
//     tc.protocol_params,
//     None,
//     redeemer,
//     tc.protocol_output_ref,
//     this_tx,
//   )
// }
