use aiken/crypto.{ScriptHash, VerificationKeyHash}
use cardano/address.{Address}
use cardano/assets.{AssetName, PolicyId}
use cardano/transaction.{Input, Output}

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

pub type ClassifiedInputs {
  vault: List<Input>,
  protocol: List<Input>,
}

pub type ClassifiedOutputs {
  vault: List<Output>,
  protocol: List<Output>,
  settings: List<Output>,
  user: List<Output>,
  other: List<Output>,
}
