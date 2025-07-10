use aiken/builtin.{serialise_data}
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use aiken/primitive/string
use cardano/address.{Address, Script, VerificationKey}
use cardano/assets.{match}
use cardano/transaction.{Input, Output}
use types.{SignerHash}

pub fn is_signed_by(reqd_signers: List<SignerHash>, signer: SignerHash) -> Bool {
  list.has(reqd_signers, signer)
}

pub fn get_script_hash_frm_output(output: Output, caller: String) -> ScriptHash {
  when output.address.payment_credential is {
    Script(script_hash) -> script_hash
    VerificationKey(_) ->
      fail string.concat(
        caller,
        @": Given output is not locked in a script; get_script_hash_frm_output()",
      )
  }
}

pub fn find_script_input(
  inputs: List<Input>,
  script_hash: ScriptHash,
) -> Option<Input> {
  list.find(
    inputs,
    fn(input) {
      when input.output.address.payment_credential is {
        Script(hash) -> hash == script_hash
        _ -> False
      }
    },
  )
}

pub fn find_script_output(
  outputs: List<Output>,
  script_hash: ScriptHash,
) -> Option<Output> {
  list.find(
    outputs,
    fn(output) {
      when output.address.payment_credential is {
        Script(hash) -> hash == script_hash
        _ -> False
      }
    },
  )
}

pub fn find_address_output(
  outputs: List<Output>,
  address: Address,
) -> Option<Output> {
  list.find(outputs, fn(output) { output.address == address })
}

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
    values_match?,
    datums_match?,
  }
}
