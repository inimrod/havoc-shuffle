use protocol
use test_constants as tc
use types.{CancelShuffle, LiveShuffle, ReShuffle, SpendBadUtxo}

test live_shuffle_succeed() {
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
    tc.test_tx_liveshuffle,
  )
}

test re_shuffle_succeed() {
  let redeemer =
    ReShuffle {
      protocol_idxs: (0, 0),
      settings_idx: 0,
      request_idx: 1,
      pool_idxs: [2],
      pool_oidx: 1,
      user_idx: 2,
    }
  protocol.protocol.spend(
    tc.protocol_params,
    None,
    redeemer,
    tc.protocol_output_ref,
    tc.test_tx_reshuffle,
  )
}

test cancel_shuffle_succeed() {
  let redeemer =
    CancelShuffle {
      protocol_idxs: (0, 0),
      settings_idx: 0,
      request_idx: 1,
      user_idx: 1,
    }
  protocol.protocol.spend(
    tc.protocol_params,
    None,
    redeemer,
    tc.protocol_output_ref,
    tc.test_tx_cancel_shuffle,
  )
}

test spend_bad_utxo_vault_succeed() {
  let redeemer =
    SpendBadUtxo { protocol_idxs: (0, 0), bad_utxo_idx: 1, settings_idx: 0 }
  protocol.protocol.spend(
    tc.protocol_params,
    None,
    redeemer,
    tc.protocol_output_ref,
    tc.test_tx_spend_bad_utxo_vault,
  )
}
