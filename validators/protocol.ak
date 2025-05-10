//// This contains the main validator business logic

use aiken/collection/dict.{keys, size}
use aiken/collection/list
use cardano/address.{Script, VerificationKey}
use cardano/assets.{match, tokens}
use cardano/script_context.{ScriptContext}
use cardano/transaction.{InlineDatum, OutputReference, Transaction}
use helpers.{
  classify_inputs, classify_outputs, get_settings, total_inputs_value,
  total_outputs_value, validate_liveshuffle_return_utxo,
  validate_protocol_output, validate_reshuffle_return_utxo,
}
use types.{
  Administer, CancelShuffle, LiveShuffle, ProtocolParams, ReShuffle,
  UnifiedRedeemer, VaultDatum,
}
use utils.{is_signed_by}

validator protocol(params: ProtocolParams) {
  spend(
    _datum: Option<Data>,
    redeemer: UnifiedRedeemer,
    output_ref: OutputReference,
    this_tx: Transaction,
  ) {
    when redeemer is {
      LiveShuffle -> {
        let settings =
          get_settings(
            this_tx.inputs,
            params.settings_policy,
            params.beacon_asset_name,
          )
        let protocol_output_valid =
          validate_protocol_output(this_tx, output_ref, settings)
        let classified_inputs = classify_inputs(this_tx.inputs, settings)
        let only_one_vault_input = and {
            1 == list.length(classified_inputs.vault.request),
            0 == list.length(classified_inputs.vault.pool),
          }
        expect Some(vault_input) = list.head(classified_inputs.vault.request)
        expect InlineDatum(vault_datum) = vault_input.output.datum
        expect vault_datum: VaultDatum = vault_datum
        let classified_outputs =
          classify_outputs(
            this_tx.outputs,
            settings,
            params.settings_policy,
            vault_datum.owner,
          )
        expect Some(user_output) = list.head(classified_outputs.user)
        expect Some(vault_output) = list.head(classified_outputs.vault)

        let input_nfts_qty =
          tokens(vault_input.output.value, settings.s2_policy_id) |> size()
        let minted_nfts_qty =
          tokens(this_tx.mint, settings.s2_policy_id) |> size()
        let valid_shuffle_qty =
          input_nfts_qty >= 1 && input_nfts_qty <= settings.max_to_shuffle
        let valid_mint_qty = minted_nfts_qty == input_nfts_qty
        let valid_mint_recipient = match(this_tx.mint, user_output.value, <=)

        let only_one_user_output = 1 == list.length(classified_outputs.user)
        let only_one_vault_output = 1 == list.length(classified_outputs.vault)
        let no_other_output = 0 == list.length(classified_outputs.other)

        let vault_output_valid =
          validate_liveshuffle_return_utxo(vault_input, vault_output)

        and {
          protocol_output_valid?,
          only_one_vault_input?,
          valid_shuffle_qty?,
          valid_mint_qty?,
          valid_mint_recipient?,
          only_one_user_output?,
          only_one_vault_output?,
          no_other_output?,
          vault_output_valid?,
        }
      }
      ReShuffle -> {
        let settings =
          get_settings(
            this_tx.inputs,
            params.settings_policy,
            params.beacon_asset_name,
          )
        let protocol_output_valid =
          validate_protocol_output(this_tx, output_ref, settings)
        let classified_inputs = classify_inputs(this_tx.inputs, settings)
        let only_one_request_input =
          1 == list.length(classified_inputs.vault.request)
        let min_1_pool_input = 1 <= list.length(classified_inputs.vault.pool)
        let pool_inputs_value = total_inputs_value(classified_inputs.vault.pool)
        expect Some(request_input) = list.head(classified_inputs.vault.request)
        expect InlineDatum(request_datum) = request_input.output.datum
        expect request_datum: VaultDatum = request_datum
        let s2_tokens_in_request =
          tokens(request_input.output.value, settings.s2_policy_id)
        let s2_qty_in_request = size(s2_tokens_in_request)

        let classified_outputs =
          classify_outputs(
            this_tx.outputs,
            settings,
            params.settings_policy,
            request_datum.owner,
          )
        let user_output_value = total_outputs_value(classified_outputs.user)
        let s2_qty_in_user_output =
          tokens(user_output_value, settings.s2_policy_id) |> size()
        let valid_s2_qty_in_user_output =
          s2_qty_in_request == s2_qty_in_user_output
        expect Some(vault_output) = list.head(classified_outputs.vault)
        let valid_reshuffle_return_utxo =
          validate_reshuffle_return_utxo(
            vault_output,
            pool_inputs_value,
            keys(s2_tokens_in_request),
            s2_qty_in_request,
            settings.s2_policy_id,
          )

        and {
          protocol_output_valid?,
          only_one_request_input?,
          min_1_pool_input?,
          valid_s2_qty_in_user_output?,
          valid_reshuffle_return_utxo?,
        }
      }
      CancelShuffle -> {
        let settings =
          get_settings(
            this_tx.inputs,
            params.settings_policy,
            params.beacon_asset_name,
          )
        let protocol_output_valid =
          validate_protocol_output(this_tx, output_ref, settings)
        let classified_inputs = classify_inputs(this_tx.inputs, settings)
        let only_one_vault_input = and {
            1 == list.length(classified_inputs.vault.request),
            0 == list.length(classified_inputs.vault.pool),
          }
        expect Some(vault_input) = list.head(classified_inputs.vault.request)
        expect InlineDatum(vault_datum) = vault_input.output.datum
        expect vault_datum: VaultDatum = vault_datum
        let classified_outputs =
          classify_outputs(
            this_tx.outputs,
            settings,
            params.settings_policy,
            vault_datum.owner,
          )
        let user_output_value = total_outputs_value(classified_outputs.user)
        let user_output_valid =
          match(vault_input.output.value, user_output_value, <=)
        let owner =
          when vault_datum.owner.payment_credential is {
            VerificationKey(hash) -> hash
            Script(hash) -> hash
          }
        let signed_by_owner = is_signed_by(this_tx.extra_signatories, owner)
        let signed_by_admin =
          is_signed_by(this_tx.extra_signatories, params.admin)
        let validly_signed = signed_by_owner || signed_by_admin
        and {
          protocol_output_valid?,
          only_one_vault_input?,
          user_output_valid?,
          validly_signed?,
        }
      }
      Administer -> is_signed_by(this_tx.extra_signatories, params.admin)
      _ -> fail @"Invalid redeemer for protocol::spend"
    }
  }

  else(context: ScriptContext) {
    let this_tx: Transaction = context.transaction
    is_signed_by(this_tx.extra_signatories, params.admin)
  }
}
