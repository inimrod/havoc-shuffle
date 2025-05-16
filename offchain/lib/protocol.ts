import { applyParamsToScript, Data, Script, validatorToAddress, validatorToScriptHash } from "@lucid-evolution/lucid";
import { adminPkh, adminStakeCred, blueprint, provNetwork } from "./common.ts";
import { settingsBeaconTknName, settingsScriptHash } from "./settings.ts";

const ProtocolValParamsSchema = Data.Object({
    admin: Data.Bytes({ minLength: 28, maxLength: 28 }),
    settings_policy: Data.Bytes({ minLength: 0, maxLength: 28 }),
    beacon_asset_name: Data.Bytes({ minLength: 0, maxLength: 64 }),
});
type ProtocolValParams = Data.Static<typeof ProtocolValParamsSchema>;
const ProtocolValParams = ProtocolValParamsSchema as unknown as ProtocolValParams;
const protocolValParams: ProtocolValParams = {
    admin: adminPkh,
    settings_policy: settingsScriptHash,
    beacon_asset_name: settingsBeaconTknName,
};
export const protocolValParamsData: Data = Data.from(Data.to(protocolValParams, ProtocolValParams));

const protocolValidatorId = "protocol.protocol.spend";
const protocolCompiledCode = blueprint.validators.find((v: { title: string }) => v.title === protocolValidatorId).compiledCode;
export const protocolScript: Script = {
    type: "PlutusV3",
    script: applyParamsToScript(protocolCompiledCode, [protocolValParamsData]),
};
export const protocolScriptHash = validatorToScriptHash(protocolScript);
export const protocolScriptAddr = validatorToAddress(provNetwork, protocolScript, adminStakeCred);
console.log(`protocolScriptAddr: ${protocolScriptAddr}`);
