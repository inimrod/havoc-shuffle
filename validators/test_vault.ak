use test_constants as tc
use types.{LiveShuffle, ReShuffle}
use vault

test live_shuffle_succeed() {
  let redeemer =
    LiveShuffle {
      protocol_idxs: (1, 1),
      vault_idxs: (0, 0),
      user_idx: 2,
      ref_idxs: [3, 4],
      settings_idx: 0,
    }
  vault.vault.spend(
    tc.protocol_params,
    None,
    redeemer,
    tc.protocol_output_ref,
    tc.test_tx_liveshuffle,
  )
}

// fail point: wrong index provided in redeemer for settings reference input
test live_shuffle_fail() fail {
  let redeemer =
    LiveShuffle {
      protocol_idxs: (1, 1),
      vault_idxs: (0, 0),
      user_idx: 2,
      ref_idxs: [3, 4],
      settings_idx: 1,
    }
  vault.vault.spend(
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
  vault.vault.spend(
    tc.protocol_params,
    None,
    redeemer,
    tc.protocol_output_ref,
    tc.test_tx_reshuffle,
  )
}

// fail point: tx inputs don't include a utxo from the protocol contract
test re_shuffle_fail() fail {
  let redeemer =
    ReShuffle {
      protocol_idxs: (0, 0),
      settings_idx: 0,
      request_idx: 1,
      pool_idxs: [2],
      pool_oidx: 1,
      user_idx: 2,
    }
  vault.vault.spend(
    tc.protocol_params,
    None,
    redeemer,
    tc.protocol_output_ref,
    tc.test_bad_tx_reshuffle_2,
  )
}
