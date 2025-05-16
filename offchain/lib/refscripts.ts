import {
    applyParamsToScript,
    fromText,
    Script,
    validatorToAddress,
    validatorToRewardAddress,
    validatorToScriptHash,
} from "@lucid-evolution/lucid";
import { adminPkh, adminStakeCred, blueprint, CredentialType, provNetwork } from "./common.ts";

const refscriptsValidatorId = "refscripts.refscripts.spend";
const refscriptsCompiledCode =
    blueprint.validators.find((v: { title: string }) => v.title === refscriptsValidatorId).compiledCode;
export const refscriptsScript: Script = {
    type: "PlutusV3",
    script: applyParamsToScript(refscriptsCompiledCode, [adminPkh]),
};
export const refscriptsScriptHash = validatorToScriptHash(refscriptsScript);
export const refscriptsScriptAddr = validatorToAddress(provNetwork, refscriptsScript, adminStakeCred);
console.log(`refscriptsScriptAddr: ${refscriptsScriptAddr}`);
export const refscriptsCredential = { type: CredentialType.script, hash: refscriptsScriptHash };
export const refscriptsRewardAddr = validatorToRewardAddress(provNetwork, refscriptsScript);

/**
 * Beacon tokens for the utxos that will hold the protocol's reference scripts
 */
export const refscriptsPolicyID = refscriptsScriptHash;
export const beaconTokens = {
    refscripts: refscriptsPolicyID + fromText(`refscripts`),
    settings: refscriptsPolicyID + fromText(`settings`),
    vault: refscriptsPolicyID + fromText(`vault`),
    protocol: refscriptsPolicyID + fromText(`protocol`),
};
