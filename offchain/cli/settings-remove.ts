import {
    adminPkh,
    deployed,
    getLucidInstance,
    RedeemerType,
    settingsBeaconTknName,
    settingsPolicyID,
    settingsScriptAddr,
    UnifiedRedeemer,
} from "../index.ts";
import { Data, stringify } from "@lucid-evolution/lucid";

if (!deployed || !deployed.referenceUtxos) {
    console.log(`Reference UTXOs not yet deployed. Exiting...`);
    Deno.exit(0);
}

const lucid = getLucidInstance();

// reference script
const refUtxos = await lucid.utxosAt(deployed.refscriptsScriptAddr);
const settingsRefUtxo = refUtxos.find((utxo) => {
    if (utxo.assets[deployed.beaconTokens.settings]) return true;
    else return false;
})!;

// settings utxo
const settingsUtxos = await lucid.utxosAt(settingsScriptAddr);
const settingsUtxo = settingsUtxos.find((utxo) => {
    if (utxo.assets[settingsPolicyID + settingsBeaconTknName]) return true;
    else return false;
})!;

const cfgBeaconAsset = settingsPolicyID + settingsBeaconTknName;
const assetsToBurn = {
    [cfgBeaconAsset]: -1n,
};
const burnCfgBeacon: UnifiedRedeemer = RedeemerType.BurnBeaconToken;
const burnCfgBeaconRedeemer = Data.to(burnCfgBeacon, UnifiedRedeemer);

const updateCfg: UnifiedRedeemer = RedeemerType.UpdateSettings;
const updateCfgRedeemer = Data.to(updateCfg, UnifiedRedeemer);

const tx = await lucid
    .newTx()
    .mintAssets(assetsToBurn, burnCfgBeaconRedeemer)
    .collectFrom([settingsUtxo], updateCfgRedeemer)
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
console.log(`tx submitted. Hash: ${txHash}`);
