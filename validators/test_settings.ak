use settings
use test_constants as tc
use types.{BurnSettingsBeacon, MintSettingsBeacon, SpendBadUtxo, UpdateSettings}

test mint_mint_beacon_succeed() {
  let redeemer = MintSettingsBeacon { init_utxo_idx: 0 }
  settings.settings.mint(
    tc.init_output_ref,
    redeemer,
    tc.settings_script_hash,
    tc.test_tx_mint_settings_bcn,
  )
}

// fail point: init utxo not included in tx inputs
test mint_mint_beacon_fail() fail {
  let redeemer = MintSettingsBeacon { init_utxo_idx: 0 }
  settings.settings.mint(
    tc.init_output_ref,
    redeemer,
    tc.settings_script_hash,
    tc.test_bad_tx_mint_settings_bcn,
  )
}

test mint_burn_beacon_succeed() {
  let redeemer = BurnSettingsBeacon { gcfg_utxo_idx: 0 }
  settings.settings.mint(
    tc.init_output_ref,
    redeemer,
    tc.settings_script_hash,
    tc.test_tx_burn_settings_bcn,
  )
}

// fail point: beacon token not burned
test mint_burn_beacon_fail() fail {
  let redeemer = BurnSettingsBeacon { gcfg_utxo_idx: 0 }
  settings.settings.mint(
    tc.init_output_ref,
    redeemer,
    tc.settings_script_hash,
    tc.test_bad_tx_burn_settings_bcn,
  )
}

test spend_update_cfg_succeed() {
  let redeemer = UpdateSettings { input_idx: 0, output_idx: 0 }
  settings.settings.spend(
    tc.init_output_ref,
    Some(tc.settings_datum_data),
    redeemer,
    tc.settings_output_ref,
    tc.test_tx_update_settings,
  )
}

// fail point: beacon token not included in settings output utxo
test spend_update_cfg_fail() fail {
  let redeemer = UpdateSettings { input_idx: 0, output_idx: 0 }
  settings.settings.spend(
    tc.init_output_ref,
    Some(tc.settings_datum_data),
    redeemer,
    tc.settings_output_ref,
    tc.test_bad_tx_update_settings,
  )
}

test spend_burn_beacon_succeed() {
  let redeemer = BurnSettingsBeacon { gcfg_utxo_idx: 0 }
  settings.settings.spend(
    tc.init_output_ref,
    Some(tc.settings_datum_data),
    redeemer,
    tc.settings_output_ref,
    tc.test_tx_burn_settings_bcn,
  )
}

// fail point: beacon token not burned
test spend_burn_beacon_fail() fail {
  let redeemer = BurnSettingsBeacon { gcfg_utxo_idx: 0 }
  settings.settings.spend(
    tc.init_output_ref,
    Some(tc.settings_datum_data),
    redeemer,
    tc.settings_output_ref,
    tc.test_bad_tx_burn_settings_bcn,
  )
}

test spend_bad_utxo_succeed() {
  let redeemer =
    SpendBadUtxo { protocol_idxs: (0, 0), bad_utxo_idx: 0, settings_idx: 0 }
  settings.settings.spend(
    tc.init_output_ref,
    Some(tc.settings_datum_data),
    redeemer,
    tc.settings_output_ref,
    tc.test_tx_spend_bad_utxo_settings,
  )
}

// fail point: 
test spend_bad_utxo_fail() fail {
  let redeemer =
    SpendBadUtxo { protocol_idxs: (0, 0), bad_utxo_idx: 0, settings_idx: 0 }
  settings.settings.spend(
    tc.init_output_ref,
    Some(tc.settings_datum_data),
    redeemer,
    tc.settings_output_ref,
    tc.test_bad_tx_spend_bad_utxo_settings,
  )
}
