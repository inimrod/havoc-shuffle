use aiken/crypto.{Blake2b_224, Hash, ScriptHash, VerificationKeyHash}
use cardano/address.{Address}
use cardano/assets.{PolicyId}
use cardano/transaction.{Input, Output}

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

pub type ClassifiedVaultInputs {
  request: List<Input>,
  pool: List<Input>,
}

pub type ClassifiedInputs {
  vault: ClassifiedVaultInputs,
  protocol: List<Input>,
}

pub type ClassifiedOutputs {
  refscripts: List<Output>,
  reftokens: List<Output>,
  vault: List<Output>,
  protocol: List<Output>,
  settings: List<Output>,
  user: List<Output>,
  other: List<Output>,
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
    /// Index of the CIP68 reftoken output
    ref_idx: Int,
    /// Index of the settings *reference* input
    settings_idx: Int,
  }
  ReShuffle {
    /// Indeces of the protocol contract utxos (input and output)
    protocol_idxs: (Int, Int),
    /// Index of the settings *reference* input
    settings_idx: Int,
  }

  CancelShuffle

  Administer

  RetireProtocol

  SpendBadUtxo { bad_utxo_idx: Int, gcfg_utxo_idx: Int }
}
