import { applyParamsToScript, Data, fromText, Script, validatorToAddress, validatorToScriptHash } from "@lucid-evolution/lucid";
import { adminStakeCred, blueprint, provNetwork, OutputReference, OutputReferenceType } from "./common.ts";


export function buildSettingsScript(outputRef:OutputReferenceType) {
    const settingsValParams: OutputReferenceType = outputRef;
    const settingsValParamsData: Data = Data.from(Data.to(settingsValParams, OutputReference));

    const settingsValidatorId = "settings.settings.spend";
    const settingsCompiledCode = blueprint.validators.find((v: { title: string }) => v.title === settingsValidatorId).compiledCode;
    const settingsScript: Script = {
        type: "PlutusV3",
        script: applyParamsToScript(settingsCompiledCode, [settingsValParamsData]),
    };
    const settingsScriptHash = validatorToScriptHash(settingsScript);
    const settingsScriptAddr = validatorToAddress(provNetwork, settingsScript, adminStakeCred);
    const settingsPolicyID = settingsScriptHash;
    
    console.log(`settingsScriptAddr: ${settingsScriptAddr}`);

    return {
        Script: settingsScript,
        ScriptHash: settingsScriptHash,
        ScriptAddr: settingsScriptAddr,
        PolicyID: settingsPolicyID
    }
}

export const settingsBeaconTknName = fromText(`GCFG`);

export const SettingsDatumSchema = Data.Object({
    admin: Data.Bytes({ minLength: 28, maxLength: 28 }),
    refscripts: Data.Bytes({ minLength: 28, maxLength: 28 }),
    reftokens: Data.Bytes({ minLength: 28, maxLength: 28 }),
    vault: Data.Bytes({ minLength: 28, maxLength: 28 }),
    protocol: Data.Bytes({ minLength: 28, maxLength: 28 }),
    s2_policy_id: Data.Bytes({ minLength: 28, maxLength: 28 }),
    max_to_shuffle: Data.Integer(),
});
export type SettingsDatumType = Data.Static<typeof SettingsDatumSchema>;
export const SettingsDatum = SettingsDatumSchema as unknown as SettingsDatumType;

export function makeSettingsDatum(obj: SettingsDatumType): Data {
    const settingsDatumData: Data = Data.to(obj, SettingsDatum);
    return settingsDatumData;
}
