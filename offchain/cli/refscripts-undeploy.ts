import {
    adminPkh,
    beaconTokens,
    deployDetailsFile,
    deployed,
    getLucidInstance,
    getEmulatorInstance,
    provNetwork,
    // emulator,
    // emuUserAcct,
    refscriptsRewardAddr,
    refscriptsScript,
    getDeployedRefUtxos,    
} from "../index.ts";
import { prepInitUtxos, deployRescripts } from "./refscripts-deploy.ts"; 
import { Data, stringify } from "@lucid-evolution/lucid";


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


const refUtxos = provNetwork == "Custom" 
    ? getDeployedRefUtxos(Object.values(deployed.referenceUtxos))
    : await lucid.utxosAt(deployed.refscriptsScriptAddr);

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
console.log(`Undeploy tx submitted. Hash: ${txHash}`);
console.log("");

// if (provNetwork == "Custom"){ // for emulator only
//     const txEval = await emulator.evaluateTx(signedTx.toCBOR(), refUtxos);
//     console.log("Tx Evaluation:", txEval);
//     console.log("");

// } else { // for real networks
//     const txHash = await signedTx.submit();
//     console.log(`tx submitted. Hash: ${txHash}`);
//     console.log("");
// }


delete deployed.referenceUtxos;

const data = new TextEncoder().encode(stringify(deployed));
Deno.writeFileSync(deployDetailsFile, data);
console.log(`Updated ${deployDetailsFile}`);
