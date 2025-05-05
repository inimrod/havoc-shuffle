use aiken/builtin.{serialise_data}
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Address, Script}
use cardano/assets.{AssetName, match, quantity_of}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, find_input,
}
use types.{ClassifiedInputs, ClassifiedOutputs, SettingsDatum}
use utils.{find_script_input, find_script_output}

pub fn input_output_match(
  input: Input,
  input_datum: Option<Data>,
  output: Output,
) -> Bool {
  let values_match = match(input.output.value, output.value, ==)
  let orig_datum =
    when input_datum is {
      Some(data) -> data
      None -> {
        let datum_data: Data = input.output.datum
        datum_data
      }
    }
  let output_datum: Data = output.datum
  let datums_match = serialise_data(orig_datum) == serialise_data(output_datum)
  and {
    values_match,
    datums_match,
  }
}

pub fn get_settings(
  inputs: List<Input>,
  settings_policy: ScriptHash,
  beacon_asset_name: AssetName,
) -> SettingsDatum {
  expect Some(settings_input) = find_script_input(inputs, settings_policy)
  expect
    1 == quantity_of(
      settings_input.output.value,
      settings_policy,
      beacon_asset_name,
    )
  expect InlineDatum(settings_datum) = settings_input.output.datum
  expect settings: SettingsDatum = settings_datum
  settings
}

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

pub fn validate_vault_output(input: Input, output: Output) -> Bool {
  let valid_values = match(input.output.value, output.value, >=)
  let output_has_no_datum = output.datum == NoDatum
  valid_values? && output_has_no_datum?
}

pub fn classify_inputs(
  inputs: List<Input>,
  settings: SettingsDatum,
) -> ClassifiedInputs {
  list.foldl(
    inputs,
    ClassifiedInputs { vault: [], protocol: [] },
    fn(input, accum) {
      when input.output.address.payment_credential is {
        Script(script_hash) ->
          if script_hash == settings.vault {
            ClassifiedInputs {
              vault: list.push(accum.vault, input),
              protocol: accum.protocol,
            }
          } else if script_hash == settings.protocol {
            ClassifiedInputs {
              vault: accum.vault,
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

pub fn classify_outputs(
  outputs: List<Output>,
  settings: SettingsDatum,
  settings_hash: ScriptHash,
  user_address: Address,
) -> ClassifiedOutputs {
  let SettingsDatum { vault, protocol, .. } = settings
  list.foldl(
    outputs,
    ClassifiedOutputs {
      vault: [],
      protocol: [],
      settings: [],
      user: [],
      other: [],
    },
    fn(output, accum) {
      if output.address == user_address {
        ClassifiedOutputs { ..accum, user: list.push(accum.user, output) }
      } else {
        when output.address.payment_credential is {
          Script(script_hash) ->
            if script_hash == vault {
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
