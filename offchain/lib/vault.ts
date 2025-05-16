import { applyParamsToScript, Data, Script, validatorToAddress, validatorToScriptHash } from "@lucid-evolution/lucid";
import { AddressObj, AddressSchema, adminPkh, adminStakeCred, blueprint, provNetwork } from "./common.ts";
import { settingsBeaconTknName, settingsScriptHash } from "./settings.ts";

const VaultValParamsSchema = Data.Object({
    admin: Data.Bytes({ minLength: 28, maxLength: 28 }),
    settings_policy: Data.Bytes({ minLength: 0, maxLength: 28 }),
    beacon_asset_name: Data.Bytes({ minLength: 0, maxLength: 64 }),
});
type VaultValParams = Data.Static<typeof VaultValParamsSchema>;
const VaultValParams = VaultValParamsSchema as unknown as VaultValParams;
const vaultValParams: VaultValParams = {
    admin: adminPkh,
    settings_policy: settingsScriptHash,
    beacon_asset_name: settingsBeaconTknName,
};
export const vaultValParamsData: Data = Data.from(Data.to(vaultValParams, VaultValParams));

const vaultValidatorId = "vault.vault.spend";
const vaultCompiledCode = blueprint.validators.find((v: { title: string }) => v.title === vaultValidatorId).compiledCode;
export const vaultScript: Script = {
    type: "PlutusV3",
    script: applyParamsToScript(vaultCompiledCode, [vaultValParamsData]),
};
export const vaultScriptHash = validatorToScriptHash(vaultScript);
export const vaultScriptAddr = validatorToAddress(provNetwork, vaultScript, adminStakeCred);
console.log(`vaultScriptAddr: ${vaultScriptAddr}`);

export type VaultDatumObj = {
    owner: AddressObj;
};
export const VaultDatumSchema = Data.Object({
    owner: AddressSchema,
});
type VaultDatum = Data.Static<typeof VaultDatumSchema>;
export const VaultDatum = VaultDatumSchema as unknown as VaultDatum;

export function makeVaultDatum(obj: VaultDatumObj): Data {
    const vaultDatumData: Data = Data.to(obj, VaultDatum);
    return vaultDatumData;
}
