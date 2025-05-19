use cardano/address.{Address, Inline, Script, VerificationKey}
use cardano/assets.{from_asset, from_lovelace, merge, zero}
use cardano/transaction.{InlineDatum, Input, NoDatum, Output, OutputReference}
use types.{ProtocolParams, SettingsDatum, VaultDatum, VaultParams}

pub const settings_script_hash =
  #"00a0b79a29bb50da169ef9ee302aa8acca1dd62ba2d7fa57331847f0"

pub const vault_script_hash =
  #"00a0b79a29bb50da169ef9ee302aa8acca1dd62ba2d7fa57331847f1"

pub const protocol_script_hash =
  #"00a0b79a29bb50da169ef9ee302aa8acca1dd62ba2d7fa57331847f2"

pub const s2_policy_id =
  #"00a0b79a29bb50da169ef9ee302aa8acca1dd62ba2d7fa57331847f3"

pub const admin_key_hash =
  #"da299558c70a8970781806dca93d1801ba2f3b3894227a7b284786e4"

pub const user_payment_keyhash =
  #"d48838fee1e840857dab28a04dd88193aec8c297b85d8150c0a1f5cc"

pub const user_staking_keyhash =
  #"6313a1d2c296eb3341e159b6c5c6991de11e81062b95108c9aa024ad"

pub const beacon_asset_name = #"73657474696e6773"

pub const user_address =
  Address {
    payment_credential: VerificationKey(user_payment_keyhash),
    stake_credential: Some(Inline(VerificationKey(user_staking_keyhash))),
  }

pub const settings_script_address =
  Address {
    payment_credential: Script(settings_script_hash),
    stake_credential: None,
  }

pub const vault_script_address =
  Address {
    payment_credential: Script(vault_script_hash),
    stake_credential: None,
  }

pub const protocol_script_address =
  Address {
    payment_credential: Script(protocol_script_hash),
    stake_credential: None,
  }

pub const protocol_params =
  ProtocolParams {
    admin: admin_key_hash,
    settings_policy: settings_script_hash,
    beacon_asset_name,
  }

pub const vault_params =
  VaultParams {
    admin: admin_key_hash,
    settings_policy: settings_script_hash,
    beacon_asset_name,
  }

pub const settings_datum =
  SettingsDatum {
    refscripts: settings_script_hash,
    reftokens: settings_script_hash,
    vault: vault_script_hash,
    protocol: protocol_script_hash,
    s2_policy_id,
    max_to_shuffle: 5,
  }

pub const settings_output_ref =
  OutputReference {
    transaction_id: #"0000000000000000000000000000000000000000000000000000000000000000",
    output_index: 0,
  }

pub const settings_output =
  Output {
    address: settings_script_address,
    value: from_asset(settings_script_hash, beacon_asset_name, 1),
    datum: InlineDatum(settings_datum),
    reference_script: None,
  }

pub const settings_input =
  Input { output_reference: settings_output_ref, output: settings_output }

pub const protocol_output_ref =
  OutputReference {
    transaction_id: #"0000000000000000000000000000000000000000000000000000000000000003",
    output_index: 0,
  }

pub const protocol_output =
  Output {
    address: protocol_script_address,
    value: from_lovelace(1_000_000),
    datum: NoDatum,
    reference_script: None,
  }

pub const protocol_input =
  Input { output_reference: protocol_output_ref, output: protocol_output }

// (222) HW S2 1042
pub const hw_s2_1042_usr =
  from_asset(s2_policy_id, #"000de14048572053322031303432", 1)

// (222) HW S2 1041
pub const hw_s2_1041_usr =
  from_asset(s2_policy_id, #"000de14048572053322031303431", 1)

// (100) HW S2 1042
pub const hw_s2_1042_ref =
  from_asset(s2_policy_id, #"000643b048572053322031303432", 1)

// (100) HW S2 1041
pub const hw_s2_1041_ref =
  from_asset(s2_policy_id, #"000643b048572053322031303431", 1)

pub const vault_output_request_ref =
  OutputReference {
    transaction_id: #"0000000000000000000000000000000000000000000000000000000000000001",
    output_index: 0,
  }

pub const vault_output_request =
  Output {
    address: vault_script_address,
    value: zero
      |> merge(hw_s2_1042_usr)
      |> merge(hw_s2_1041_usr),
    datum: InlineDatum(VaultDatum { owner: user_address }),
    reference_script: None,
  }

pub const vault_input_request =
  Input {
    output_reference: vault_output_request_ref,
    output: vault_output_request,
  }

pub const vault_output_pool_ref =
  OutputReference {
    transaction_id: #"0000000000000000000000000000000000000000000000000000000000000002",
    output_index: 0,
  }

pub const vault_output_pool =
  Output {
    address: vault_script_address,
    value: zero
      |> merge(hw_s2_1042_usr)
      |> merge(hw_s2_1041_usr),
    datum: NoDatum,
    reference_script: None,
  }

pub const vault_input_pool =
  Input { output_reference: vault_output_pool_ref, output: vault_output_pool }

pub const user_liveshuffle_output_ref =
  OutputReference {
    transaction_id: #"0000000000000000000000000000000000000000000000000000000000000004",
    output_index: 0,
  }

pub const user_liveshuffle_input_value =
  zero
    |> merge(hw_s2_1042_usr)
    |> merge(hw_s2_1041_usr)

pub const user_liveshuffle_io =
  Output {
    address: user_address,
    value: user_liveshuffle_input_value,
    datum: NoDatum,
    reference_script: None,
  }

pub const user_liveshuffle_input =
  Input {
    output_reference: user_liveshuffle_output_ref,
    output: user_liveshuffle_io,
  }

const user_tokens_value =
  zero
    |> merge(from_asset(s2_policy_id, #"000de14048572053322031303639", 1))
    |> merge(from_asset(s2_policy_id, #"000de14048572053322030303639", 1))

// from_asset_list(
//   [
//     Pair(
//       s2_policy_id,
//       [
//         Pair(#"000de14048572053322031303639", 1),
//         Pair(#"000de14048572053322030303639", 1),
//       ],
//     ),
//   ],
// )

pub const user_liveshuffle_output_from_mint =
  Output {
    address: user_address,
    value: user_tokens_value,
    datum: NoDatum,
    reference_script: None,
  }
