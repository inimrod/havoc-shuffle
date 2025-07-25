//// This contains the main validator business logic

use aiken/collection/dict.{keys, size, to_pairs}
use aiken/collection/list
use cardano/address.{Credential, Script, VerificationKey}
use cardano/assets.{is_zero, tokens}
use cardano/certificate.{Certificate, RegisterCredential, UnregisterCredential}
use cardano/script_context.{ScriptContext}
use cardano/transaction.{InlineDatum, OutputReference, Transaction}
use constants.{global_cfg_token as cfg_token}
use helpers.{
  classify_inputs, classify_outputs, get_cfg, total_inputs_value,
  total_outputs_value, validate_cancel_shuffle_user_output,
  validate_liveshuffle_return_utxo, validate_liveshuffle_user_output,
  validate_protocol_output, validate_reshuffle_return_utxo,
}
use types.{
  CancelShuffle, LiveShuffle, ProtocolParams, ReShuffle, RetireProtocol,
  UnifiedRedeemer, VaultDatum,
}
use utils.{input_output_match, is_signed_by}

validator protocol(params: ProtocolParams) {
  spend(
    _datum: Option<Data>,
    redeemer: UnifiedRedeemer,
    out_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      LiveShuffle { protocol_idxs, vault_idxs, user_idx, ref_idx, settings_idx } -> {
        // protocol input and output validation
        expect Some(protocol_input) = list.at(tx.inputs, protocol_idxs.1st)
        expect Some(protocol_output) = list.at(tx.outputs, protocol_idxs.2nd)
        expect out_ref == protocol_input.output_reference
        let protocol_output_valid =
          input_output_match(protocol_input, None, protocol_output)

        // get config settings
        let cfg = get_cfg(tx.reference_inputs, settings_idx, params.cfg_policy)
        // vault input and output
        expect Some(vault_input) = list.at(tx.inputs, vault_idxs.1st)
        expect InlineDatum(vault_datum) = vault_input.output.datum
        expect vault_datum: VaultDatum = vault_datum
        expect Some(vault_output) = list.at(tx.outputs, vault_idxs.2nd)
        let vault_output_valid =
          validate_liveshuffle_return_utxo(vault_input, vault_output, cfg)

        // validate shuffle/mint
        let input_nfts_qty =
          tokens(vault_input.output.value, cfg.s2_policy_id) |> size()
        let minted_nfts_qty = tokens(tx.mint, cfg.s2_policy_id) |> size()
        let valid_shuffle_qty = and {
            input_nfts_qty >= 1,
            input_nfts_qty <= cfg.max_to_shuffle,
          }
        trace @"input_nfts_qty ": input_nfts_qty
        trace @"minted_nfts_qty ": minted_nfts_qty

        // CIP68 tokens are always minted in pairs: the user and the reference tokens
        let valid_mint_qty = minted_nfts_qty == input_nfts_qty * 2

        // validate user output
        expect Some(user_output) = list.at(tx.outputs, user_idx)
        let owner = vault_datum.owner
        let valid_mint_recipient =
          validate_liveshuffle_user_output(tx.mint, owner, user_output, cfg)

        // validate cip68 ref token output
        expect Some(ref_output) = list.at(tx.outputs, ref_idx)
        let valid_ref_output =
          Script(cfg.reftokens) == ref_output.address.payment_credential

        // restrict number of inputs and outputs
        // inputs should only be 1 from protocol and 1 from vault contract
        // outputs should only be 1 to protocol, 1 to vault, 1 to refTokens contract, and 1 to user
        let inputs_count_valid = 2 == list.length(tx.inputs)
        let outputs_count_valid = 4 == list.length(tx.outputs)

        and {
          protocol_output_valid?,
          vault_output_valid?,
          valid_shuffle_qty?,
          valid_mint_qty?,
          valid_mint_recipient?,
          valid_ref_output?,
          inputs_count_valid?,
          outputs_count_valid?,
        }
      }
      ReShuffle -> {
        let settings =
          get_settings(
            tx.inputs,
            params.settings_policy,
            params.beacon_asset_name,
          )
        let protocol_output_valid =
          validate_protocol_output(tx, out_ref, settings)
        let no_tokens_minted = is_zero(tx.mint)
        let classified_inputs = classify_inputs(tx.inputs, settings)
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
            tx.outputs,
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
            settings.s2_policy_id,
          )

        and {
          protocol_output_valid?,
          no_tokens_minted?,
          only_one_request_input?,
          min_1_pool_input?,
          valid_s2_qty_in_user_output?,
          valid_reshuffle_return_utxo?,
        }
      }
      CancelShuffle -> {
        let settings =
          get_settings(
            tx.inputs,
            params.settings_policy,
            params.beacon_asset_name,
          )
        let protocol_output_valid =
          validate_protocol_output(tx, out_ref, settings)
        let classified_inputs = classify_inputs(tx.inputs, settings)
        let only_one_vault_input = and {
            1 == list.length(classified_inputs.vault.request),
            0 == list.length(classified_inputs.vault.pool),
          }
        expect Some(request_input) = list.head(classified_inputs.vault.request)
        expect InlineDatum(request_datum) = request_input.output.datum
        expect request_datum: VaultDatum = request_datum

        let s2_tokens_in_request =
          tokens(request_input.output.value, settings.s2_policy_id)
            |> to_pairs()

        let classified_outputs =
          classify_outputs(
            tx.outputs,
            settings,
            params.settings_policy,
            request_datum.owner,
          )
        let user_output_value = total_outputs_value(classified_outputs.user)
        let s2_tokens_in_output =
          tokens(user_output_value, settings.s2_policy_id)
        let user_output_valid =
          validate_cancel_shuffle_user_output(
            s2_tokens_in_request,
            s2_tokens_in_output,
          )
        let owner =
          when request_datum.owner.payment_credential is {
            VerificationKey(hash) -> hash
            Script(hash) -> hash
          }
        let signed_by_owner = is_signed_by(tx.extra_signatories, owner)
        let signed_by_admin = is_signed_by(tx.extra_signatories, params.admin)
        let validly_signed = signed_by_owner || signed_by_admin
        and {
          protocol_output_valid?,
          only_one_vault_input?,
          user_output_valid?,
          validly_signed?,
        }
      }
      SpendBadUtxo { bad_utxo_idx, .. } -> {
        expect Some(input) = list.at(tx.inputs, bad_utxo_idx)
        expect out_ref == input.output_reference
        expect Script(own_hash) = input.output.address.payment_credential
        let in_withdrawals = pairs.has_key(tx.withdrawals, Script(own_hash))
        in_withdrawals?
      }
      _ -> fail @"Invalid redeemer for protocol::spend"
    }
  }

  withdraw(redeemer: UnifiedRedeemer, _own_cred: Credential, tx: Transaction) {
    when redeemer is {
      SpendBadUtxo { gcfg_utxo_idx, .. } -> {
        let cfg = get_cfg(tx.reference_inputs, gcfg_utxo_idx, params.cfg_policy)
        let signed_by_admin = is_signed_by(tx.extra_signatories, cfg.admin)
        signed_by_admin?
      }
      _ -> fail @"Invalid redeemer for protocol::withdraw"
    }
  }

  publish(redeemer: UnifiedRedeemer, cert: Certificate, tx: Transaction) {
    when redeemer is {
      // Not using input index here because at this time, offchain tx builder (lucid-evo) doesn't support
      // RedeemerBuilder (redeemer indexing) for the `publish` validator purpose
      RetireProtocol ->
        when cert is {
          UnregisterCredential { credential, .. } -> {
            expect Script(own_hash) = credential
            expect Some(cfg_input) =
              list.find(
                tx.inputs,
                fn(input) {
                  1 == quantity_of(
                    input.output.value,
                    params.cfg_policy,
                    cfg_token,
                  )
                },
              )
            let cfg = get_global_settings_from_input(cfg_input)
            let withdrawal_valid = cfg.protocol == own_hash
            let signed_by_admin = is_signed_by(tx.extra_signatories, cfg.admin)
            and {
              withdrawal_valid?,
              signed_by_admin?,
            }
          }
          _ -> fail @"Unsupported certificate type for protocol::publish"
        }
      _ -> fail @"Invalid redeemer for protocol::publish"
    }
  }

  else(context: ScriptContext) {
    let tx: Transaction = context.transaction
    is_signed_by(tx.extra_signatories, params.admin)
  }
}
