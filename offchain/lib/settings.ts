import { applyParamsToScript, Data, fromText, Script, validatorToAddress, validatorToScriptHash } from "@lucid-evolution/lucid";
import { adminPkh, adminStakeCred, blueprint, provNetwork } from "./common.ts";

const settingsValidatorId = "settings.settings.spend";
const settingsCompiledCode = blueprint.validators.find((v: { title: string }) => v.title === settingsValidatorId).compiledCode;
export const settingsScript: Script = {
    type: "PlutusV3",
    script: applyParamsToScript(settingsCompiledCode, [adminPkh]),
};
export const settingsScriptHash = validatorToScriptHash(settingsScript);
export const settingsScriptAddr = validatorToAddress(provNetwork, settingsScript, adminStakeCred);
export const settingsPolicyID = settingsScriptHash;
export const settingsBeaconTknName = fromText(`CONFIG`);
console.log(`settingsScriptAddr: ${settingsScriptAddr}`);

export type SettingsDatumObj = {
    refscripts: string;
    reftokens: string;
    vault: string;
    protocol: string;
    s2_policy_id: string;
    max_to_shuffle: bigint;
};
export const SettingsDatumSchema = Data.Object({
    refscripts: Data.Bytes({ minLength: 28, maxLength: 28 }),
    reftokens: Data.Bytes({ minLength: 28, maxLength: 28 }),
    vault: Data.Bytes({ minLength: 28, maxLength: 28 }),
    protocol: Data.Bytes({ minLength: 28, maxLength: 28 }),
    s2_policy_id: Data.Bytes({ minLength: 28, maxLength: 28 }),
    max_to_shuffle: Data.Integer(),
});
type SettingsDatum = Data.Static<typeof SettingsDatumSchema>;
export const SettingsDatum = SettingsDatumSchema as unknown as SettingsDatum;

export function makeSettingsDatum(obj: SettingsDatumObj): Data {
    const settingsDatumData: Data = Data.to(obj, SettingsDatum);
    return settingsDatumData;
}
