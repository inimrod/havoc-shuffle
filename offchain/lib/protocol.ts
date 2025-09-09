import { applyParamsToScript, Data, Script, validatorToAddress, validatorToScriptHash } from "@lucid-evolution/lucid";
import { adminStakeCred, blueprint, provNetwork, ProtocolValParamsType, ProtocolValParams } from "./common.ts";

export function buildProtocolScript(settingsScriptHash: string) {
    const protocolValParams: ProtocolValParamsType = {
        cfg_policy: settingsScriptHash
    };
    const protocolValParamsData: Data = Data.from(Data.to(protocolValParams, ProtocolValParams));

    const protocolValidatorId = "protocol.protocol.spend";
    const protocolCompiledCode = blueprint.validators.find((v: { title: string }) => v.title === protocolValidatorId).compiledCode;
    const protocolScript: Script = {
        type: "PlutusV3",
        script: applyParamsToScript(protocolCompiledCode, [protocolValParamsData]),
    };
    const protocolScriptHash = validatorToScriptHash(protocolScript);
    const protocolScriptAddr = validatorToAddress(provNetwork, protocolScript, adminStakeCred);
    console.log(`protocolScriptAddr: ${protocolScriptAddr}`);

    return {
        Script: protocolScript,
        ScriptHash: protocolScriptHash,
        ScriptAddr: protocolScriptAddr
    }
}
