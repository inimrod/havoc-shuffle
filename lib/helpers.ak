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
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, find_input,
}
use constants.{global_cfg_token, prefix_222}
use types.{
  ClassifiedInputs, ClassifiedOutputs, ClassifiedVaultInputs, SettingsDatum,
  VaultDatum,
}
use utils.{find_script_output, input_output_match}

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

/// Checks that the utxo from the `protocol` contract is returned
pub fn validate_protocol_output(
  tx: Transaction,
  output_ref: OutputReference,
  settings: SettingsDatum,
) -> Bool {
  expect Some(input_from_self) = find_input(tx.inputs, output_ref)
  expect Some(output_to_self) =
    find_script_output(tx.outputs, settings.protocol)
  input_output_match(input_from_self, None, output_to_self)
}

pub fn validate_liveshuffle_user_output(
  minted: Value,
  user_output: Output,
  settings: SettingsDatum,
) -> Bool {
  let s2_policy_id = settings.s2_policy_id
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
  match(minted_user_tokens, user_output.value, <=)
}

pub fn validate_liveshuffle_return_utxo(input: Input, output: Output) -> Bool {
  let valid_values = match(input.output.value, output.value, >=)
  let output_has_no_datum =
    when output.datum is {
      NoDatum -> True
      _ -> False
    }
  valid_values? && output_has_no_datum?
}

/// Classifies inputs according to their source. i.e. from the `vault` and `protocol` contracts
pub fn classify_inputs(
  inputs: List<Input>,
  settings: SettingsDatum,
) -> ClassifiedInputs {
  list.foldl(
    inputs,
    ClassifiedInputs {
      vault: ClassifiedVaultInputs { request: [], pool: [] },
      protocol: [],
    },
    fn(input, accum) {
      when input.output.address.payment_credential is {
        Script(script_hash) ->
          if script_hash == settings.vault {
            when input.output.datum is {
              InlineDatum(datum) ->
                if datum is VaultDatum {
                  ClassifiedInputs {
                    ..accum,
                    vault: ClassifiedVaultInputs {
                      ..accum.vault,
                      request: list.push(accum.vault.request, input),
                    },
                  }
                } else {
                  ClassifiedInputs {
                    ..accum,
                    vault: ClassifiedVaultInputs {
                      ..accum.vault,
                      pool: list.push(accum.vault.pool, input),
                    },
                  }
                }
              _ ->
                ClassifiedInputs {
                  ..accum,
                  vault: ClassifiedVaultInputs {
                    ..accum.vault,
                    pool: list.push(accum.vault.pool, input),
                  },
                }
            }
          } else if script_hash == settings.protocol {
            ClassifiedInputs {
              ..accum,
              protocol: list.push(accum.protocol, input),
            }
          } else {
            accum
          }
        _ -> accum
      }
    },
  )
}

/// Classifies outputs according to destination.
pub fn classify_outputs(
  outputs: List<Output>,
  settings: SettingsDatum,
  settings_hash: ScriptHash,
  user_address: Address,
) -> ClassifiedOutputs {
  let SettingsDatum { refscripts, reftokens, vault, protocol, .. } = settings
  list.foldl(
    outputs,
    ClassifiedOutputs {
      refscripts: [],
      reftokens: [],
      vault: [],
      protocol: [],
      settings: [],
      user: [],
      other: [],
    },
    fn(output, accum) {
      if output.address == user_address {
        trace @"user output:"
        trace @"output.address": output.address
        trace @"user_address": user_address
        trace @"output": output
        trace @"-------"
        ClassifiedOutputs { ..accum, user: list.push(accum.user, output) }
      } else {
        when output.address.payment_credential is {
          Script(script_hash) ->
            if script_hash == refscripts {
              ClassifiedOutputs {
                ..accum,
                refscripts: list.push(accum.refscripts, output),
              }
            } else if script_hash == reftokens {
              ClassifiedOutputs {
                ..accum,
                reftokens: list.push(accum.reftokens, output),
              }
            } else if script_hash == vault {
              ClassifiedOutputs {
                ..accum,
                vault: list.push(accum.vault, output),
              }
            } else if script_hash == protocol {
              ClassifiedOutputs {
                ..accum,
                protocol: list.push(accum.protocol, output),
              }
            } else if script_hash == settings_hash {
              ClassifiedOutputs {
                ..accum,
                settings: list.push(accum.settings, output),
              }
            } else {
              ClassifiedOutputs {
                ..accum,
                other: list.push(accum.other, output),
              }
            }
          _ ->
            ClassifiedOutputs { ..accum, other: list.push(accum.other, output) }
        }
      }
    },
  )
}

pub fn total_outputs_value(outputs: List<Output>) -> Value {
  list.foldl(outputs, zero, fn(output, accum) { merge(accum, output.value) })
}

pub fn total_inputs_value(inputs: List<Input>) -> Value {
  list.foldl(
    inputs,
    zero,
    fn(input, accum) { merge(accum, input.output.value) },
  )
}

pub fn validate_reshuffle_return_utxo(
  vault_output: Output,
  pool_inputs_value: Value,
  s2_tokens_in_request: List<AssetName>,
  s2_policy_id: PolicyId,
) -> Bool {
  let ada_in_input = lovelace_of(pool_inputs_value)
  let ada_in_output = lovelace_of(vault_output.value)
  let input_ada_is_retained = ada_in_input == ada_in_output

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
