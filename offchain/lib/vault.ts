import { applyParamsToScript, Data, Script, validatorToAddress, validatorToScriptHash, validatorToRewardAddress } from "@lucid-evolution/lucid";
import { AddressSchema, adminStakeCred, blueprint, CredentialType, provNetwork, ProtocolValParamsType, ProtocolValParams } from "./common.ts";
import { settingsScriptHash } from "./settings.ts";


const protocolValParams: ProtocolValParamsType = {
    cfg_policy: settingsScriptHash,
};
export const protocolValParamsData: Data = Data.from(Data.to(protocolValParams, ProtocolValParams));

const vaultValidatorId = "vault.vault.spend";
const vaultCompiledCode = blueprint.validators.find((v: { title: string }) => v.title === vaultValidatorId).compiledCode;
export const vaultScript: Script = {
    type: "PlutusV3",
    script: applyParamsToScript(vaultCompiledCode, [protocolValParamsData]),
};
export const vaultScriptHash = validatorToScriptHash(vaultScript);
export const vaultScriptAddr = validatorToAddress(provNetwork, vaultScript, adminStakeCred);
console.log(`vaultScriptAddr: ${vaultScriptAddr}`);
export const vaultScriptCredential = { type: CredentialType.script, hash: vaultScriptHash };
export const vaultScriptRewardAddr = validatorToRewardAddress(provNetwork, vaultScript);


export const VaultDatumSchema = Data.Object({
    owner: AddressSchema,
});
export type VaultDatumType = Data.Static<typeof VaultDatumSchema>;
export const VaultDatum = VaultDatumSchema as unknown as VaultDatumType;

export function makeVaultDatum(obj: VaultDatumType): Data {
    const vaultDatumData: Data = Data.to(obj, VaultDatum);
    return vaultDatumData;
}
