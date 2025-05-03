use aiken/crypto.{ScriptHash}
use cardano/assets.{PolicyId}

pub type UnifiedRedeemer {
  MintBeaconToken
  BurnBeaconToken
  ReadSettings
  UpdateSettings
  LiveShuffle
  ReShuffle
  CancelShuffle
  RetireProtocol
}

pub type SettingsDatum {
  vault: ScriptHash,
  protocol: ScriptHash,
  s2_policy_id: PolicyId,
  max_to_shuffle: Int,
}
