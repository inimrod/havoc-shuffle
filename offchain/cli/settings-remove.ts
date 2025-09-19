import {
    adminPkh,
    deployed,
    emulator,
    provNetwork,
    getLucidInstance,
    getEmulatorInstance,
    RedeemerEnum,
    settingsBeaconTknName,
    UnifiedRedeemerType,
    UnifiedRedeemer,
} from "../index.ts";
import { Data, stringify, RedeemerBuilder } from "@lucid-evolution/lucid";
import { initializeSettings } from "./settings-initialize.ts";


console.log(`Using network: ${provNetwork}`);
const lucid = provNetwork == "Custom" ? getEmulatorInstance() : getLucidInstance();

// if using emulator, run initializeSettings() first
if (provNetwork == "Custom") {
    await initializeSettings();
}

if (!deployed || !deployed.referenceUtxos || !deployed.settingsUtxo) {
    console.log(`Reference UTXOs not yet deployed. Exiting...`);
    Deno.exit(0);
}

// reference script
const refUtxos = await lucid.utxosAt(deployed.refscriptsScriptAddr);
const settingsRefUtxo = refUtxos.find((utxo) => {
    if (utxo.assets[deployed.beaconTokens.settings]) return true;
    else return false;
})!;

// settings utxo
const cfgBeaconAsset = deployed.settingsScriptHash + settingsBeaconTknName;
const settingsUtxos = await lucid.utxosAt(deployed.settingsScriptAddr);
const settingsUtxo = settingsUtxos.find((utxo) => {
    if (utxo.assets[cfgBeaconAsset]) return true;
    else return false;
})!;

const assetsToBurn = {
    [cfgBeaconAsset]: -1n,
};

// spend redeemer
const spendRedeemer: RedeemerBuilder = {
    kind: "selected",
    inputs: [settingsUtxo],
    makeRedeemer: (inputIdxs: bigint[]) => {
        const redeemer: UnifiedRedeemerType = {
            [RedeemerEnum.BurnSettingsBeacon]: {
                gcfg_utxo_idx: inputIdxs[0]
            },
        };
        return Data.to(redeemer, UnifiedRedeemer);
    },
};

// burn redeemer
const burnRedeemer: RedeemerBuilder = {
    kind: "selected",
    inputs: [settingsUtxo],
    makeRedeemer: (inputIdxs: bigint[]) => {
        const redeemer: UnifiedRedeemerType = {
            [RedeemerEnum.BurnSettingsBeacon]: {
                gcfg_utxo_idx: inputIdxs[0]
            },
        };
        return Data.to(redeemer, UnifiedRedeemer);
    },
};


const tx = await lucid
    .newTx()
    .mintAssets(assetsToBurn, burnRedeemer)
    .collectFrom([settingsUtxo], spendRedeemer)
    .attachMetadata(674, { msg: ["Havoc Shuffle remove settings"] })
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
console.log(`Remove settings tx submitted. Hash: ${txHash}`);

// Simulate the passage of time and block confirmations
if (provNetwork == "Custom") {
    await emulator.awaitBlock(10);
    console.log("emulated passage of 10 blocks..");
    console.log("");
}
