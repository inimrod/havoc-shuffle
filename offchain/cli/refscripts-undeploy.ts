import {
    adminPkh,
    beaconTokens,
    deployDetailsFile,
    deployed,
    getLucidInstance,
    provNetwork,
    refscriptsScript,
    refscriptsRewardAddr
} from "../index.ts";
import { Data, stringify } from "@lucid-evolution/lucid";

if (!deployed || !deployed.referenceUtxos) {
    console.log(`Reference UTXOs not yet deployed. Exiting...`);
    Deno.exit(0);
}

console.log(`Using network: ${provNetwork}`);
const lucid = getLucidInstance();

/*
// De-register script stake hash
const tx0 = await lucid
    .newTx()
    .deregister.Stake(refscriptsRewardAddr, Data.void())
    .attach.Script(refscriptsScript)
    .addSignerKey(adminPkh)
    .complete();
console.log(`register refscript stake addr tx built`);
const signedTx0 = await tx0.sign.withWallet().complete();
console.log(`signedTx0: ${stringify(signedTx0)}`);
console.log(`signedTx0 hash: ${signedTx0.toHash()}`);
console.log(`size: ~${signedTx0.toCBOR().length / 2048} KB`);
console.log("");

console.log("");
const tx0Json = JSON.parse(stringify(signedTx0));
console.log(`txFee: ${parseInt(tx0Json.body.fee) / 1_000_000} ADA`);
console.log("");
// Deno.exit(0);
const tx0Hash = await signedTx0.submit();
console.log(`tx submitted. Hash: ${tx0Hash}`);
console.log("");
*/



const refUtxos = await lucid.utxosAt(deployed.refscriptsScriptAddr);

const assetsToBurn = {
    [beaconTokens.refscripts]: -1n,
    [beaconTokens.settings]: -1n,
    [beaconTokens.vault]: -1n,
    [beaconTokens.protocol]: -1n,
};
const tx = await lucid
    .newTx()
    .mintAssets(assetsToBurn, Data.void())
    .collectFrom(refUtxos, Data.void())
    .withdraw(refscriptsRewardAddr, 0n, Data.void())
    .deregister.Stake(refscriptsRewardAddr, Data.void())
    .attach.Script(refscriptsScript)
    .addSignerKey(adminPkh)
    .complete();
console.log(`undeploy refscripts tx built`);
const signedTx = await tx.sign.withWallet().complete();
console.log(`signedTx: ${stringify(signedTx)}`);
console.log(`signedTx hash: ${signedTx.toHash()}`);
console.log(`size: ~${signedTx.toCBOR().length / 2048} KB`);
console.log("");

console.log("");
const txJson = JSON.parse(stringify(signedTx));
console.log(`txFee: ${parseInt(txJson.body.fee) / 1_000_000} ADA`);
console.log("");
// Deno.exit(0);
const txHash = await signedTx.submit();
console.log(`tx submitted. Hash: ${txHash}`);
console.log("");

delete deployed.referenceUtxos;

const data = new TextEncoder().encode(stringify(deployed));
Deno.writeFileSync(deployDetailsFile, data);
console.log(`Updated ${deployDetailsFile}`);
