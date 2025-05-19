use cardano/transaction.{InlineDatum, Output, Transaction, placeholder}
use settings
use test_constants as tc
use types.{ReadSettings, SettingsDatum, UpdateSettings}

test read_settings_succeed() {
  let this_tx =
    Transaction {
      ..placeholder,
      mint: tc.hw_s2_1042_usr,
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
        tc.user_liveshuffle_output_from_mint,
      ],
    }
  let datum = Some(tc.settings_datum)
  let redeemer = ReadSettings
  settings.settings.spend(
    tc.admin_key_hash,
    datum,
    redeemer,
    tc.settings_output_ref,
    this_tx,
  )
}

test read_settings_fail() {
  let new_settings_datum =
    SettingsDatum { ..tc.settings_datum, max_to_shuffle: 4 }
  let settings_output =
    Output { ..tc.settings_output, datum: InlineDatum(new_settings_datum) }
  let this_tx =
    Transaction {
      ..placeholder,
      mint: tc.hw_s2_1042_usr,
      inputs: [
        tc.settings_input,
        tc.vault_input_request,
        tc.protocol_input,
        tc.user_liveshuffle_input,
      ],
      outputs: [
        settings_output,
        tc.vault_output_pool,
        tc.protocol_output,
        tc.user_liveshuffle_output_from_mint,
      ],
    }
  let datum = Some(tc.settings_datum)
  let redeemer = ReadSettings
  False == settings.settings.spend(
    tc.admin_key_hash,
    datum,
    redeemer,
    tc.settings_output_ref,
    this_tx,
  )
}

test update_settings_succeed() {
  let this_tx =
    Transaction {
      ..placeholder,
      inputs: [tc.settings_input],
      outputs: [tc.settings_output],
      extra_signatories: [tc.admin_key_hash],
    }
  let datum = Some(tc.settings_datum)
  let redeemer = UpdateSettings
  settings.settings.spend(
    tc.admin_key_hash,
    datum,
    redeemer,
    tc.settings_output_ref,
    this_tx,
  )
}

test update_settings_fail() {
  let this_tx =
    Transaction {
      ..placeholder,
      inputs: [tc.settings_input],
      outputs: [tc.settings_output],
      extra_signatories: [tc.user_payment_keyhash],
    }
  let datum = Some(tc.settings_datum)
  let redeemer = UpdateSettings
  False == settings.settings.spend(
    tc.admin_key_hash,
    datum,
    redeemer,
    tc.settings_output_ref,
    this_tx,
  )
}
