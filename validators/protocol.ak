//// This contains the main validator business logic

use aiken/collection/dict.{keys, size}
use aiken/collection/list
use cardano/address.{Script, VerificationKey}
use cardano/assets.{is_zero, tokens}
use cardano/transaction.{InlineDatum, OutputReference, Transaction}
use helpers.{
  confirm_bad_vault_utxos, confirm_pool_utxos, count_vault_inputs, get_cfg,
  total_pool_inputs_value, validate_cancel_shuffle_user_output,
  validate_liveshuffle_ref_outputs, validate_liveshuffle_return_utxo,
  validate_liveshuffle_user_output, validate_protocol_utxos,
  validate_reshuffle_return_utxo, validate_reshuffle_user_output,
}
use types.{
  Administer, CancelShuffle, LiveShuffle, ProtocolParams, ReShuffle,
  RetireProtocol, SpendBadUtxo, UnifiedRedeemer, VaultDatum,
}
use utils.{is_signed_by}

validator protocol(params: ProtocolParams) {
  spend(
    _datum: Option<Data>,
    redeemer: UnifiedRedeemer,
    out_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      LiveShuffle {
        protocol_idxs,
        vault_idxs,
        user_idx,
        ref_idxs,
        settings_idx,
      } -> {
        // protocol input and output validation
        let protocol_utxos_valid =
          validate_protocol_utxos(tx.inputs, tx.outputs, out_ref, protocol_idxs)

        // get config settings
        let cfg = get_cfg(tx.reference_inputs, settings_idx, params.cfg_policy)
        // vault input and output
        expect Some(vault_input) = list.at(tx.inputs, vault_idxs.1st)
        let vault_input_valid =
          Script(cfg.vault) == vault_input.output.address.payment_credential
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

        // CIP68 tokens are always minted in pairs: the user and the reference tokens
        let valid_mint_qty = minted_nfts_qty == input_nfts_qty * 2

        // validate user output
        expect Some(user_output) = list.at(tx.outputs, user_idx)
        let owner = vault_datum.owner
        let valid_mint_recipient =
          validate_liveshuffle_user_output(tx.mint, owner, user_output, cfg)

        // validate cip68 ref token outputs
        let valid_ref_outputs = and {
            list.length(ref_idxs) == input_nfts_qty,
            validate_liveshuffle_ref_outputs(tx.outputs, ref_idxs, cfg),
          }

        // restrict number of inputs from vault contract
        // inputs should contain only 1 utxo from the vault contract
        let vault_inputs_count = count_vault_inputs(tx.inputs, cfg)
        let inputs_count_valid = vault_inputs_count == 1
        trace @"vault_inputs_count count": vault_inputs_count
        trace @"inputs count": list.length(tx.inputs)

        and {
          protocol_utxos_valid?,
          vault_input_valid?,
          vault_output_valid?,
          valid_shuffle_qty?,
          valid_mint_qty?,
          valid_mint_recipient?,
          valid_ref_outputs?,
          inputs_count_valid?,
        }
      }
      ReShuffle {
        protocol_idxs,
        settings_idx,
        request_idx,
        pool_idxs,
        pool_oidx,
        user_idx,
      } -> {
        // protocol input and output validation
        let protocol_utxos_valid =
          validate_protocol_utxos(tx.inputs, tx.outputs, out_ref, protocol_idxs)
        // get config settings
        let cfg = get_cfg(tx.reference_inputs, settings_idx, params.cfg_policy)
        // make sure there are no minted tokens
        let no_tokens_minted = is_zero(tx.mint)
        // parse user request input
        expect Some(request_input) = list.at(tx.inputs, request_idx)
        let valid_request_input =
          Script(cfg.vault) == request_input.output.address.payment_credential
        expect InlineDatum(request_datum) = request_input.output.datum
        expect req_datum: VaultDatum = request_datum
        let s2_tokens_in_request =
          tokens(request_input.output.value, cfg.s2_policy_id)
        let s2_qty_in_request = size(s2_tokens_in_request)

        // validate and get total Value of all vault inputs
        let pool_inputs_value =
          total_pool_inputs_value(tx.inputs, pool_idxs, cfg)

        // validate user and vault outputs
        expect Some(user_output) = list.at(tx.outputs, user_idx)
        let valid_user_output =
          validate_reshuffle_user_output(
            s2_qty_in_request,
            req_datum.owner,
            user_output,
            cfg,
          )
        expect Some(vault_output) = list.at(tx.outputs, pool_oidx)
        let valid_reshuffle_return_utxo =
          validate_reshuffle_return_utxo(
            vault_output,
            pool_inputs_value,
            keys(s2_tokens_in_request),
            cfg.s2_policy_id,
          )

        // make sure the tx only consumes the expected number of inputs from the vault contract
        // 1 request utxo + however many pool utxos are needed (specified in redeemer)
        let vault_inputs_count = count_vault_inputs(tx.inputs, cfg)
        let expected_vault_inputs = 1 + list.length(pool_idxs)
        let valid_inputs_count = expected_vault_inputs == vault_inputs_count

        and {
          protocol_utxos_valid?,
          no_tokens_minted?,
          valid_request_input?,
          valid_user_output?,
          valid_reshuffle_return_utxo?,
          valid_inputs_count?,
        }
      }
      CancelShuffle { protocol_idxs, settings_idx, request_idx, user_idx } -> {
        // protocol input and output validation
        let protocol_utxos_valid =
          validate_protocol_utxos(tx.inputs, tx.outputs, out_ref, protocol_idxs)

        // get config settings
        let cfg = get_cfg(tx.reference_inputs, settings_idx, params.cfg_policy)

        // make sure only 1 vault utxo is spent
        let only_one_vault_input = 1 == count_vault_inputs(tx.inputs, cfg)

        // parse datum in user request input
        expect Some(request_input) = list.at(tx.inputs, request_idx)
        let valid_request_input =
          Script(cfg.vault) == request_input.output.address.payment_credential
        expect InlineDatum(request_datum) = request_input.output.datum
        expect request_datum: VaultDatum = request_datum

        // validate user output contents
        expect Some(user_output) = list.at(tx.outputs, user_idx)
        let valid_user_output =
          validate_cancel_shuffle_user_output(request_input, user_output, cfg)

        // check that the tx is signed either by the owner of the request input, or by admin
        let owner =
          when request_datum.owner.payment_credential is {
            VerificationKey(hash) -> hash
            Script(hash) -> hash
          }
        let signed_by_owner = is_signed_by(tx.extra_signatories, owner)
        let signed_by_admin = is_signed_by(tx.extra_signatories, cfg.admin)
        let validly_signed = signed_by_owner || signed_by_admin
        and {
          protocol_utxos_valid?,
          only_one_vault_input?,
          valid_request_input?,
          valid_user_output?,
          validly_signed?,
        }
      }

      Administer { protocol_idxs, settings_idx } -> {
        // protocol input and output validation
        let protocol_utxos_valid =
          validate_protocol_utxos(tx.inputs, tx.outputs, out_ref, protocol_idxs)

        // get config settings
        let cfg = get_cfg(tx.reference_inputs, settings_idx, params.cfg_policy)
        let all_vault_inputs_valid = confirm_pool_utxos(tx.inputs, cfg)
        let signed_by_admin = is_signed_by(tx.extra_signatories, cfg.admin)

        and {
          protocol_utxos_valid?,
          all_vault_inputs_valid?,
          signed_by_admin?,
        }
      }
      SpendBadUtxo { protocol_idxs, settings_idx, .. } -> {
        // protocol input and output validation
        let protocol_utxos_valid =
          validate_protocol_utxos(tx.inputs, tx.outputs, out_ref, protocol_idxs)

        // get config settings
        let cfg = get_cfg(tx.reference_inputs, settings_idx, params.cfg_policy)

        let all_vault_inputs_bad = confirm_bad_vault_utxos(tx.inputs, cfg)
        let signed_by_admin = is_signed_by(tx.extra_signatories, cfg.admin)
        and {
          protocol_utxos_valid?,
          all_vault_inputs_bad?,
          signed_by_admin?,
        }
      }

      RetireProtocol { protocol_idx, settings_idx } -> {
        expect Some(protocol_input) = list.at(tx.inputs, protocol_idx)
        expect out_ref == protocol_input.output_reference
        // get config settings
        let cfg = get_cfg(tx.reference_inputs, settings_idx, params.cfg_policy)
        let signed_by_admin = is_signed_by(tx.extra_signatories, cfg.admin)
        // make sure there are no vault utxos spent
        let no_vault_input = 0 == count_vault_inputs(tx.inputs, cfg)

        and {
          signed_by_admin?,
          no_vault_input?,
        }
      }
      _ -> fail @"Invalid redeemer for protocol::spend"
    }
  }

  else(_) {
    fail @"Unsupported purpose for protocol validator"
  }
}
