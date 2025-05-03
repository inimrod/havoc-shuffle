use aiken/builtin.{serialise_data}
use cardano/assets.{match}
use cardano/transaction.{InlineDatum, Input, Output}
use types.{SettingsDatum}

pub fn validate_settings_output(
  input: Input,
  input_datum: SettingsDatum,
  output: Output,
) -> Bool {
  let values_match = match(input.output.value, output.value, ==)
  let output_datum = output.datum
  expect InlineDatum(output_datum) = output_datum
  let datums_match = serialise_data(input_datum) == serialise_data(output_datum)
  and {
    values_match,
    datums_match,
  }
}
