use cardano/address.{Address, Inline, Script, VerificationKey}
use cardano/assets.{from_asset, from_lovelace, merge, zero}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, placeholder,
}
use constants.{global_cfg_token}
use types.{ProtocolParams, SettingsDatum, VaultDatum}

pub const settings_script_hash =
  #"00a0b79a29bb50da169ef9ee302aa8acca1dd62ba2d7fa57331847f0"

pub const vault_script_hash =
  #"00a0b79a29bb50da169ef9ee302aa8acca1dd62ba2d7fa57331847f1"

pub const protocol_script_hash =
  #"00a0b79a29bb50da169ef9ee302aa8acca1dd62ba2d7fa57331847f2"

pub const s2_policy_id =
  #"00a0b79a29bb50da169ef9ee302aa8acca1dd62ba2d7fa57331847f3"

pub const reftokens_scripthash =
  #"7b2daab94563c91a58f4b0e74f405ec3ca83989da40541e911f20455"

pub const admin_key_hash =
  #"da299558c70a8970781806dca93d1801ba2f3b3894227a7b284786e4"

pub const user_payment_keyhash =
  #"d48838fee1e840857dab28a04dd88193aec8c297b85d8150c0a1f5cc"

pub const user_staking_keyhash =
  #"6313a1d2c296eb3341e159b6c5c6991de11e81062b95108c9aa024ad"

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

pub const reftokens_script_address =
  Address {
    payment_credential: Script(reftokens_scripthash),
    stake_credential: None,
  }

pub const protocol_params = ProtocolParams { cfg_policy: settings_script_hash }

pub const settings_datum =
  SettingsDatum {
    admin: admin_key_hash,
    refscripts: settings_script_hash,
    reftokens: reftokens_scripthash,
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
    value: from_asset(settings_script_hash, global_cfg_token, 1),
    datum: InlineDatum(settings_datum),
    reference_script: None,
  }

pub const settings_input =
  Input { output_reference: settings_output_ref, output: settings_output }

pub const init_output_ref =
  OutputReference {
    transaction_id: #"0000000000000000000000000000000000000000000000000000000000000069",
    output_index: 0,
  }

// Protocol contract utxo
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

// for user request input
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

// for minting:
// (100) HW S2 1069
pub const hw_s2_1069_ref =
  from_asset(s2_policy_id, #"000643b048572053322031303639", 1)

// (222) HW S2 1069
pub const hw_s2_1069_usr =
  from_asset(s2_policy_id, #"000de14048572053322031303639", 1)

// (100) HW S2 0069
pub const hw_s2_0069_ref =
  from_asset(s2_policy_id, #"000643b048572053322030303639", 1)

// (222) HW S2 0069
pub const hw_s2_0069_usr =
  from_asset(s2_policy_id, #"000de14048572053322030303639", 1)

pub const mint_s2_value =
  hw_s2_1069_ref
    |> merge(hw_s2_1069_usr)
    |> merge(hw_s2_0069_ref)
    |> merge(hw_s2_0069_usr)

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

const user_tokens_value = merge(hw_s2_1069_usr, hw_s2_0069_usr)

pub const user_liveshuffle_output_from_mint =
  Output {
    address: user_address,
    value: user_tokens_value,
    datum: NoDatum,
    reference_script: None,
  }

pub const user_liveshuffle_output_from_mint_bad =
  Output {
    address: reftokens_script_address,
    value: user_tokens_value,
    datum: NoDatum,
    reference_script: None,
  }

pub const cip68_reftoken_output1_ref =
  OutputReference {
    transaction_id: #"0000000000000000000000000000000000000000000000000000000000000005",
    output_index: 0,
  }

pub const cip68_reftoken_output2_ref =
  OutputReference {
    transaction_id: #"0000000000000000000000000000000000000000000000000000000000000005",
    output_index: 1,
  }

// HW S2 1069 Ref
pub const cip68_reftoken1_output =
  Output {
    address: reftokens_script_address,
    value: hw_s2_1069_ref,
    datum: NoDatum,
    reference_script: None,
  }

pub const cip68_reftoken2_output =
  Output {
    address: reftokens_script_address,
    value: hw_s2_0069_ref,
    datum: NoDatum,
    reference_script: None,
  }

pub const vault_reshuffle_input =
  Input {
    output_reference: vault_output_pool_ref,
    output: Output {
      address: vault_script_address,
      value: zero
        |> merge(hw_s2_1069_usr)
        |> merge(hw_s2_0069_usr),
      datum: NoDatum,
      reference_script: None,
    },
  }

pub const vault_reshuffle_output =
  Output {
    address: vault_script_address,
    value: zero
      |> merge(hw_s2_1042_usr)
      |> merge(hw_s2_1041_usr),
    datum: NoDatum,
    reference_script: None,
  }

pub const user_reshuffle_output =
  Output {
    address: user_address,
    value: vault_reshuffle_input.output.value,
    datum: NoDatum,
    reference_script: None,
  }

pub const bad_utxo_vault =
  Input {
    output_reference: vault_output_request_ref,
    output: Output {
      ..vault_output_request,
      datum: InlineDatum(
        #"0000000000000000000000000000000000000000000000000000000000000000",
      ),
    },
  }

pub const bad_utxo_frm_vault_to_usr =
  Input {
    output_reference: vault_output_request_ref,
    output: Output { ..vault_output_request, datum: NoDatum },
  }

/// Liveshuffle Test Tx
pub const test_tx_liveshuffle =
  Transaction {
    ..placeholder,
    mint: mint_s2_value,
    inputs: [vault_input_request, protocol_input],
    outputs: [
      vault_output_pool, protocol_output, user_liveshuffle_output_from_mint,
      cip68_reftoken1_output, cip68_reftoken2_output,
    ],
    reference_inputs: [settings_input],
  }

pub const test_bad_tx_liveshuffle =
  Transaction {
    ..test_tx_liveshuffle,
    outputs: [
      vault_output_pool, protocol_output, user_liveshuffle_output_from_mint_bad,
      cip68_reftoken1_output, cip68_reftoken2_output,
    ],
  }

/// ReShuffle Test Tx
pub const test_tx_reshuffle =
  Transaction {
    ..placeholder,
    inputs: [protocol_input, vault_input_request, vault_reshuffle_input],
    outputs: [protocol_output, vault_reshuffle_output, user_reshuffle_output],
    reference_inputs: [settings_input],
  }

pub const test_bad_tx_reshuffle =
  Transaction {
    ..test_tx_reshuffle,
    inputs: [
      protocol_input, vault_input_request, vault_reshuffle_input,
      vault_input_pool,
    ],
  }

/// CancelShuffle Test Tx
pub const test_tx_cancel_shuffle =
  Transaction {
    ..placeholder,
    inputs: [protocol_input, vault_input_request],
    outputs: [protocol_output, vault_input_request.output],
    reference_inputs: [settings_input],
    extra_signatories: [user_payment_keyhash],
  }

pub const test_bad_tx_cancel_shuffle =
  Transaction { ..test_tx_cancel_shuffle, extra_signatories: [] }

/// Vaul SpendBadUtxo Test Tx
pub const test_tx_spend_bad_utxo_vault =
  Transaction {
    ..placeholder,
    inputs: [protocol_input, bad_utxo_vault],
    outputs: [protocol_output, bad_utxo_frm_vault_to_usr.output],
    reference_inputs: [settings_input],
    extra_signatories: [admin_key_hash],
  }

pub const test_bad_tx_spend_bad_utxo_vault =
  Transaction {
    ..test_tx_spend_bad_utxo_vault,
    inputs: [protocol_input, vault_input_request],
    outputs: [protocol_output, bad_utxo_frm_vault_to_usr.output],
  }

/// RetireProtocol Test Tx
pub const test_tx_retire_protocol =
  Transaction {
    ..placeholder,
    inputs: [protocol_input],
    outputs: [],
    reference_inputs: [settings_input],
    extra_signatories: [admin_key_hash],
  }

pub const test_bad_tx_retire_protocol =
  Transaction {
    ..test_tx_retire_protocol,
    inputs: [protocol_input, vault_reshuffle_input],
    outputs: [user_reshuffle_output],
  }
