use aiken/builtin.{serialise_data}
use aiken/crypto.{ScriptHash}
use cardano/assets.{AssetName, match, quantity_of}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction, find_input,
}
use types.{SettingsDatum}
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
