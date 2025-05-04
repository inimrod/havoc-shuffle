//// Minting policy for the beacon token marking the UTXO with the datum
//// containing the settings for the protocol -- mainly the latest hash of
//// the upgradeable validator.

use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{PolicyId}
use cardano/script_context.{ScriptContext}
use cardano/transaction.{InlineDatum, OutputReference, Transaction, find_input}
use helpers.{input_output_match}
use types.{
  BurnBeaconToken, MintBeaconToken, ReadSettings, SettingsDatum, UnifiedRedeemer,
  UpdateSettings,
}
use utils.{
  find_script_input, find_script_output, get_script_hash_frm_output,
  is_signed_by,
}

validator settings(admin: VerificationKeyHash) {
  mint(redeemer: UnifiedRedeemer, _this_policy: PolicyId, this_tx: Transaction) {
    when redeemer is {
      MintBeaconToken -> is_signed_by(this_tx.extra_signatories, admin)
      BurnBeaconToken -> is_signed_by(this_tx.extra_signatories, admin)
      _ -> fail @"Invalid redeemer for settings::mint"
    }
  }

  spend(
    datum: Option<SettingsDatum>,
    redeemer: UnifiedRedeemer,
    output_ref: OutputReference,
    this_tx: Transaction,
  ) {
    when redeemer is {
      ReadSettings -> {
        expect Some(input_from_self) = find_input(this_tx.inputs, output_ref)
        let own_hash =
          get_script_hash_frm_output(input_from_self.output, @"settings::spend")
        let output_to_self = find_script_output(this_tx.outputs, own_hash)
        expect Some(output_to_self) = output_to_self
        expect Some(settings_datum) = datum
        let settings_data: Data = InlineDatum(settings_datum)
        let settings_output_valid =
          input_output_match(
            input_from_self,
            Some(settings_data),
            output_to_self,
          )
        let SettingsDatum { vault, .. } = settings_datum
        let vault_input = find_script_input(this_tx.inputs, vault)
        let has_input_from_vault =
          when vault_input is {
            Some(_input) -> True
            None -> False
          }
        settings_output_valid && has_input_from_vault
      }
      UpdateSettings -> is_signed_by(this_tx.extra_signatories, admin)
      _ -> fail @"Invalid redeemer for settings::spend"
    }
  }

  else(context: ScriptContext) {
    let this_tx: Transaction = context.transaction
    is_signed_by(this_tx.extra_signatories, admin)
  }
}
