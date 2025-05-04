use aiken/crypto.{ScriptHash, VerificationKeyHash}
use cardano/assets.{AssetName, PolicyId}

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
  owner: VerificationKeyHash,
  asset_name: AssetName,
  amount: Int,
}

pub type VaultParams {
  admin: VerificationKeyHash,
  settings_policy: ScriptHash,
  beacon_asset_name: AssetName,
}

pub type ProtocolParams {
  admin: VerificationKeyHash,
  settings: ScriptHash,
}
