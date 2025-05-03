use aiken/collection/list
use aiken/crypto.{ScriptHash, VerificationKeyHash}
use aiken/primitive/string
use cardano/address.{Script, VerificationKey}
use cardano/transaction.{Output}

pub fn is_signed_by(
  reqd_signers: List<VerificationKeyHash>,
  signer: VerificationKeyHash,
) -> Bool {
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
