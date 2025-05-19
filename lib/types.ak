use aiken/crypto.{Blake2b_224, Hash, ScriptHash, VerificationKeyHash}
use cardano/address.{Address}
use cardano/assets.{AssetName, PolicyId}
use cardano/transaction.{Input, Output}

pub type SignerHash =
  Hash<Blake2b_224, ByteArray>

pub type UnifiedRedeemer {
  MintBeaconToken
  BurnBeaconToken
  ReadSettings
  UpdateSettings
  LiveShuffle
  ReShuffle
  CancelShuffle
  Administer
}

pub type SettingsDatum {
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

pub type VaultParams {
  admin: VerificationKeyHash,
  settings_policy: ScriptHash,
  beacon_asset_name: AssetName,
}

pub type ProtocolParams {
  admin: VerificationKeyHash,
  settings_policy: ScriptHash,
  beacon_asset_name: AssetName,
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
