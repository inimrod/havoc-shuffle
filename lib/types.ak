use aiken/crypto.{Blake2b_224, Hash, ScriptHash, VerificationKeyHash}
use cardano/address.{Address}
use cardano/assets.{PolicyId}

pub type SignerHash =
  Hash<Blake2b_224, ByteArray>

pub type SettingsDatum {
  admin: VerificationKeyHash,
  refscripts: ScriptHash,
  reftokens: ScriptHash,
  vault: ScriptHash,
  protocol: ScriptHash,
  s2_policy_id: PolicyId,
  max_to_shuffle: Int,
}

pub type VaultDatum {
  owner: Address,
}

pub type ProtocolParams {
  cfg_policy: ScriptHash,
}

pub type UnifiedRedeemer {
  MintSettingsBeacon { init_utxo_idx: Int }
  BurnSettingsBeacon { gcfg_utxo_idx: Int }
  UpdateSettings { input_idx: Int, output_idx: Int }
  LiveShuffle {
    /// Indeces of the protocol contract utxos (input and output)
    protocol_idxs: (Int, Int),
    /// Indeces of the vault contract utxos (input and output)
    vault_idxs: (Int, Int),
    /// Index of the output to the user
    user_idx: Int,
    /// Indeces of the CIP68 reftoken outputs
    ref_idxs: List<Int>,
    /// Index of the settings *reference* input
    settings_idx: Int,
  }
  ReShuffle {
    /// Indeces of the protocol contract utxos (input and output)
    protocol_idxs: (Int, Int),
    /// Index of the settings *reference* input
    settings_idx: Int,
    /// Index of user's shuffle request utxo
    request_idx: Int,
    /// Indeces of the input utxos from the vault to be used for the shuffle
    pool_idxs: List<Int>,
    /// Index of the output to the vault contract
    pool_oidx: Int,
    /// Index of the output to the user
    user_idx: Int,
  }

  CancelShuffle {
    /// Indeces of the protocol contract utxos (input and output)
    protocol_idxs: (Int, Int),
    /// Index of the settings *reference* input
    settings_idx: Int,
    /// Index of user's shuffle request utxo
    request_idx: Int,
    /// Index of the output to the user
    user_idx: Int,
  }

  /// used for cleaning up bad utxos in settings and vault contracts
  SpendBadUtxo {
    /// Indeces of the protocol contract utxos (input and output).
    /// This may be provided with placeholder values if cleaning up bad utxos in settings contract.
    protocol_idxs: (Int, Int),
    /// Index of the bad utxo input
    /// This may be provided with placeholder value only, if cleaning up bad utxos in vault contract.
    bad_utxo_idx: Int,
    /// Index of the settings *reference* input
    settings_idx: Int,
  }

  RetireProtocol {
    /// Index of the protocol contract input utxo
    protocol_idx: Int,
    /// Index of the settings *reference* input
    settings_idx: Int,
  }
}
