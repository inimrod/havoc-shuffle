use aiken/collection/dict.{Dict, foldl, get, has_key, size}
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use aiken/option.{or_else}
use aiken/primitive/bytearray
use cardano/address.{Address, Script}
use cardano/assets.{
  AssetName, PolicyId, Value, from_asset, lovelace_of, match, merge, quantity_of,
  tokens, zero,
}
use cardano/transaction.{
  DatumHash, InlineDatum, Input, NoDatum, Output, OutputReference,
}
use constants.{global_cfg_token, prefix_222}
use types.{SettingsDatum, VaultDatum}
use utils.{input_output_match}

// ## Common

/// Get the global settings from the given list of inputs (utxos), the index of the settings UTXO, 
/// and the policy ID + token name of the settings beacon token.
pub fn get_cfg(
  inputs: List<Input>,
  cfg_idx: Int,
  policy_id: ScriptHash,
) -> SettingsDatum {
  expect Some(cfg_input) = list.at(inputs, cfg_idx)
  expect quantity_of(cfg_input.output.value, policy_id, global_cfg_token) == 1
  get_global_settings_from_input(cfg_input)
}

/// Get the global settings from the datum of the given settings UTXO.
pub fn get_global_settings_from_input(cfg_input: Input) -> SettingsDatum {
  expect InlineDatum(inline_datum) = cfg_input.output.datum
  expect settings: SettingsDatum = inline_datum
  settings
}

// ## Settings

/// Check the given input against the given output if the assets are returned to the same address.
/// Only the tokens are checked for equality. The lovelace amount in the output is allowed to be greater or less than
/// in the input since only the minAda is expected here and in this case, it depends on the size of the datum.
pub fn is_cfg_utxo_returned(input: Input, output: Output) -> Bool {
  let values_match =
    match(
      input.output.value,
      output.value,
      fn(input_ada, output_ada) {
        or {
          input_ada >= output_ada,
          input_ada <= output_ada,
        }
      },
    )
  let is_returned = input.output.address == output.address
  and {
    values_match,
    is_returned,
  }
}

// ## Vault

/// Checks that the given input (identified by `out_ref`) is the user's shuffle request UTXO specified in the redeemer.
pub fn is_request_utxo(
  out_ref: OutputReference,
  inputs: List<Input>,
  request_idx: Int,
) -> Bool {
  expect Some(req_input) = list.at(inputs, request_idx)
  out_ref == req_input.output_reference
}

/// Checks that the given input (identified by `out_ref`) is one of the UTXOs listed as `pool` UTXOs in the redeemer.
pub fn is_pool_utxo(
  out_ref: OutputReference,
  inputs: List<Input>,
  pool_idxs: List<Int>,
) -> Bool {
  list.any(
    pool_idxs,
    fn(idx) {
      expect Some(input) = list.at(inputs, idx)
      out_ref == input.output_reference
    },
  )
}

// ## Protocol

/// Checks that the protocol input utxo is valid and the output is returned to the `protocol` contract
pub fn validate_protocol_utxos(
  inputs: List<Input>,
  outputs: List<Output>,
  out_ref: OutputReference,
  protocol_idxs: (Int, Int),
) -> Bool {
  expect Some(input) = list.at(inputs, protocol_idxs.1st)
  expect Some(output) = list.at(outputs, protocol_idxs.2nd)
  expect out_ref == input.output_reference
  let output_valid = input_output_match(input, None, output)
  output_valid?
}

/// Checks that the given output for the user:
/// 1. has an address matching the owner address in the _request input_ datum
/// 2. contains the same amount of S2 user tokens as in the minted value
pub fn validate_liveshuffle_user_output(
  minted: Value,
  owner: Address,
  user_output: Output,
  cfg: SettingsDatum,
) -> Bool {
  let address_valid = user_output.address == owner
  let s2_policy_id = cfg.s2_policy_id
  let minted_dict = tokens(minted, s2_policy_id)
  let minted_user_tokens =
    foldl(
      minted_dict,
      zero,
      fn(token_name, qty, accum) {
        if prefix_222 == bytearray.slice(token_name, 0, 3) {
          trace @"token_name": token_name
          trace @"prefix": bytearray.slice(token_name, 0, 3)
          let user_token_value = from_asset(s2_policy_id, token_name, qty)
          merge(accum, user_token_value)
        } else {
          accum
        }
      },
    )
  trace @"minted_user_tokens": minted_user_tokens
  trace @"user_output.value": user_output.value
  let tokens_match = match(minted_user_tokens, user_output.value, <=)
  and {
    address_valid?,
    tokens_match?,
  }
}

/// Checks that the given output for the user:
/// 1. has an address matching the owner address in the _request input_ datum
/// 2. contains the same amount of S2 tokens as in the _request input_
pub fn validate_reshuffle_user_output(
  s2_qty_in_request: Int,
  owner: Address,
  user_output: Output,
  cfg: SettingsDatum,
) -> Bool {
  let address_valid = user_output.address == owner
  let s2_policy_id = cfg.s2_policy_id
  let s2_qty_in_output = tokens(user_output.value, s2_policy_id) |> size()
  let valid_s2_qty_in_output = s2_qty_in_request == s2_qty_in_output

  and {
    address_valid?,
    valid_s2_qty_in_output?,
  }
}

/// Check that the live shuffle request utxo value is returned to the vault contract
/// but this time, contains no datum anymore.
pub fn validate_liveshuffle_return_utxo(
  input: Input,
  output: Output,
  cfg: SettingsDatum,
) -> Bool {
  let address_match = and {
      Script(cfg.vault) == input.output.address.payment_credential,
      input.output.address == output.address,
    }
  let valid_values = match(input.output.value, output.value, >=)
  let output_has_no_datum =
    when output.datum is {
      NoDatum -> True
      _ -> False
    }
  and {
    address_match?,
    valid_values?,
    output_has_no_datum?,
  }
}

/// Count the number of inputs from the vault contract in the given list of inputs.
pub fn count_vault_inputs(inputs: List<Input>, settings: SettingsDatum) -> Int {
  list.count(
    inputs,
    fn(input) {
      Script(settings.vault) == input.output.address.payment_credential
    },
  )
}

/// Returns the total value of the inputs from the vault contract that will be used to
/// fulfill user's shuffle request.
pub fn total_pool_inputs_value(
  inputs: List<Input>,
  pool_idxs: List<Int>,
  cfg: SettingsDatum,
) -> Value {
  list.foldl(
    pool_idxs,
    zero,
    fn(idx, accum) {
      expect Some(input) = list.at(inputs, idx)
      expect Script(cfg.vault) == input.output.address.payment_credential
      expect NoDatum = input.output.datum
      merge(accum, input.output.value)
    },
  )
}

/// Check that the output going back to the vault contract contains:
/// 1. the same amount of ADA as in the pool inputs
/// 1. the same number of S2 tokens as in the pool inputs
/// 1. all the S2 tokens in the request input
/// 1. no datum
pub fn validate_reshuffle_return_utxo(
  vault_output: Output,
  pool_inputs_value: Value,
  s2_tokens_in_request: List<AssetName>,
  s2_policy_id: PolicyId,
) -> Bool {
  let ada_in_input = lovelace_of(pool_inputs_value)
  let ada_in_output = lovelace_of(vault_output.value)
  let input_ada_is_retained = ada_in_output >= ada_in_input

  let s2_qty_in_inputs = tokens(pool_inputs_value, s2_policy_id) |> size()
  let s2_tokens_in_output = tokens(vault_output.value, s2_policy_id)
  let s2_qty_in_output = size(s2_tokens_in_output)
  let valid_s2_qty_in_output = s2_qty_in_output == s2_qty_in_inputs
  trace @"s2_qty_in_inputs ": s2_qty_in_inputs
  trace @"s2_tokens_in_output ": s2_tokens_in_output
  trace @"s2_qty_in_output ": s2_qty_in_output
  trace @"valid_s2_qty_in_output ": valid_s2_qty_in_output

  let valid_reshuffled_s2_output =
    list.all(
      s2_tokens_in_request,
      fn(token_name) { has_key(s2_tokens_in_output, token_name) },
    )

  let output_has_no_datum =
    when vault_output.datum is {
      NoDatum -> True
      _ -> False
    }

  and {
    input_ada_is_retained?,
    valid_s2_qty_in_output?,
    valid_reshuffled_s2_output?,
    output_has_no_datum?,
  }
}

/// Check that the tokens contained in the output for the user, is exactly the same
/// as the tokens in their request input.
pub fn validate_cancel_shuffle_user_output(
  s2_tokens_in_request: Pairs<AssetName, Int>,
  s2_tokens_in_output: Dict<AssetName, Int>,
) -> Bool {
  list.all(
    s2_tokens_in_request,
    fn(tkn_pair) {
      let token_name = tkn_pair.1st
      let token_qty = tkn_pair.2nd
      let token_qty_in_output =
        get(s2_tokens_in_output, token_name) |> or_else(0)
      token_qty == token_qty_in_output
    },
  )
}

/// Check that all input utxos from the vault contract are actually bad ones. Meaning they either
/// have no valid S2 tokens or have an invalid datum.
pub fn confirm_bad_vault_utxos(
  inputs: List<Input>,
  settings: SettingsDatum,
) -> Bool {
  let vault_inputs =
    list.filter(
      inputs,
      fn(input) {
        Script(settings.vault) == input.output.address.payment_credential
      },
    )
  list.all(
    vault_inputs,
    fn(input) {
      let no_s2_tokens =
        0 == ( tokens(input.output.value, settings.s2_policy_id) |> size() )

      let has_bad_datum =
        when input.output.datum is {
          InlineDatum(datum) ->
            if datum is VaultDatum {
              False
            } else {
              True
            }
          DatumHash(_) -> True
          _ -> False
        }

      or {
        no_s2_tokens,
        has_bad_datum,
      }
    },
  )
}
