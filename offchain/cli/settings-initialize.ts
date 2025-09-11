import {
    adminPkh,
    deployed,
    emulator,
    provNetwork,
    getLucidInstance,
    getEmulatorInstance,
    makeSettingsDatum,
    RedeemerEnum,
    UnifiedRedeemerType,
    s2PolicyId,
    settingsBeaconTknName,
    SettingsDatumType,
    UnifiedRedeemer,
    refscriptsScriptHash,
    refTokensValidatorHash
} from "../index.ts";
import { Data, Datum, stringify } from "@lucid-evolution/lucid";
import { prepInitUtxos, deployRescripts } from "./refscripts-deploy.ts"; 

console.log(`Using network: ${provNetwork}`);
const lucid = provNetwork == "Custom" ? getEmulatorInstance() : getLucidInstance();

// if using emulator, run deployRescripts() first
if (provNetwork == "Custom") {
    await prepInitUtxos();
    await deployRescripts();
}

if (!deployed || !deployed.referenceUtxos) {
    console.log(`Reference UTXOs not yet deployed. Exiting...`);
    Deno.exit(0);
}

const refUtxos = await lucid.utxosAt(deployed.refscriptsScriptAddr);
const settingsRefUtxo = refUtxos.find((utxo) => {
    if (utxo.assets[deployed.beaconTokens.settings]) return true;
    else return false;
})!;

const cfgBeaconAsset = deployed.settingsScriptHash + settingsBeaconTknName;
const assetsToMint = {
    [cfgBeaconAsset]: 1n,
};
const mintCfgBeacon: UnifiedRedeemerType = {
    [RedeemerEnum.MintSettingsBeacon]: {
        init_utxo_idx: 0n
    }
}
const mintCfgBeaconRedeemer = Data.to(mintCfgBeacon, UnifiedRedeemer);

const cfgDatumObj: SettingsDatumType = {
    admin: adminPkh,
    refscripts: refscriptsScriptHash,
    reftokens: refTokensValidatorHash,
    vault: deployed.vaultScriptHash,
    protocol: deployed.protocolScriptHash,
    s2_policy_id: s2PolicyId,
    max_to_shuffle: 5n,
};
const cfgDatum = makeSettingsDatum(cfgDatumObj);
const tx = await lucid
    .newTx()
    .mintAssets(assetsToMint, mintCfgBeaconRedeemer)
    .pay.ToContract(
        deployed.settingsScriptAddr,
        { kind: "inline", value: cfgDatum as Datum },
        { [cfgBeaconAsset]: 1n },
    )
    .pay.ToContract(
        deployed.protocolScriptAddr,
        { kind: "inline", value: Data.void() },
    )
    .addSignerKey(adminPkh)
    .readFrom([settingsRefUtxo])
    .complete();

const signedTx = await tx.sign.withWallet().complete();
console.log(`signedTx: ${stringify(signedTx)}`);
console.log(`signedTx hash: ${signedTx.toHash()}`);
console.log(`size: ~${signedTx.toCBOR().length / 2048} KB`);

console.log("");
const txJson = JSON.parse(stringify(signedTx));
console.log(`txFee: ${parseInt(txJson.body.fee) / 1_000_000} ADA`);
console.log("");

// Deno.exit(0);
const txHash = await signedTx.submit();
console.log(`Init settings tx submitted. Hash: ${txHash}`);
console.log("");

// Simulate the passage of time and block confirmations
if (provNetwork == "Custom") {
    await emulator.awaitBlock(10);
    console.log("emulated passage of 10 blocks..");
    console.log("");
}
