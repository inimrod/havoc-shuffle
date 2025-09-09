import { applyParamsToScript, Data, Script, validatorToAddress, validatorToScriptHash, validatorToRewardAddress } from "@lucid-evolution/lucid";
import { AddressSchema, adminStakeCred, blueprint, CredentialType, provNetwork, ProtocolValParamsType, ProtocolValParams } from "./common.ts";

export function buildVaultScript(settingsScriptHash: string) {
    const protocolValParams: ProtocolValParamsType = {
        cfg_policy: settingsScriptHash,
    };
    const protocolValParamsData: Data = Data.from(Data.to(protocolValParams, ProtocolValParams));

    const vaultValidatorId = "vault.vault.spend";
    const vaultCompiledCode = blueprint.validators.find((v: { title: string }) => v.title === vaultValidatorId).compiledCode;
    const vaultScript: Script = {
        type: "PlutusV3",
        script: applyParamsToScript(vaultCompiledCode, [protocolValParamsData]),
    };
    const vaultScriptHash = validatorToScriptHash(vaultScript);
    const vaultScriptAddr = validatorToAddress(provNetwork, vaultScript, adminStakeCred);
    console.log(`vaultScriptAddr: ${vaultScriptAddr}`);
    const vaultScriptCredential = { type: CredentialType.script, hash: vaultScriptHash };
    const vaultScriptRewardAddr = validatorToRewardAddress(provNetwork, vaultScript);

    return {
        Script: vaultScript,
        ScriptHash: vaultScriptHash,
        ScriptAddr: vaultScriptAddr,
        ScriptCredential: vaultScriptCredential,
        ScriptRewardAddr: vaultScriptRewardAddr
    }
}

export const VaultDatumSchema = Data.Object({
    owner: AddressSchema,
});
export type VaultDatumType = Data.Static<typeof VaultDatumSchema>;
export const VaultDatum = VaultDatumSchema as unknown as VaultDatumType;

export function makeVaultDatum(obj: VaultDatumType): Data {
    const vaultDatumData: Data = Data.to(obj, VaultDatum);
    return vaultDatumData;
}
