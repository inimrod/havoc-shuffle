import {
    adminAddress,
    adminPkh,
    beaconTokens,
    deployDetailsFile,
    deployed,
    getDeployUtxos,
    getLucidInstance,
    protocolScript,
    protocolScriptAddr,
    provNetwork,
    refscriptsPolicyID,
    refscriptsScript,
    refscriptsScriptAddr,
    settingsScript,
    settingsScriptAddr,
    vaultScript,
    vaultScriptAddr,
    refscriptsRewardAddr
} from "../index.ts";
import { Data, stringify, UTxO } from "@lucid-evolution/lucid";

// Avoid re-deploying if already done
if (deployed && deployed.referenceUtxos) {
    console.log(`Reference UTXOs already deployed. Exiting...`);
    Deno.exit(0);
}

console.log(`Using network: ${provNetwork}`);
const lucid = getLucidInstance();

// There are 2 txs here:
// 1. mint beacon tokens for the refscripts
// 2. deploy compiled refscripts into UTXOs with beacon tokens

const assetsToMint = {
    [beaconTokens.refscripts]: 1n,
    [beaconTokens.settings]: 1n,
    [beaconTokens.vault]: 1n,
    [beaconTokens.protocol]: 1n,
};
const [_newWalletInputs, derivedOutputs, tx] = await lucid
    .newTx()
    .mintAssets(assetsToMint, Data.void())
    .register.Stake(refscriptsRewardAddr)
    .pay.ToContract(
        refscriptsScriptAddr,
        { kind: "inline", value: Data.void() },
        { [beaconTokens.refscripts]: 1n },
        refscriptsScript,
    )
    .pay.ToContract(
        refscriptsScriptAddr,
        { kind: "inline", value: Data.void() },
        { [beaconTokens.settings]: 1n },
        settingsScript,
    )
    .pay.ToContract(
        refscriptsScriptAddr,
        { kind: "inline", value: Data.void() },
        { [beaconTokens.vault]: 1n },
        vaultScript,
    )
    .pay.ToContract(
        refscriptsScriptAddr,
        { kind: "inline", value: Data.void() },
        { [beaconTokens.protocol]: 1n },
        protocolScript,
    )
    .attach.Script(refscriptsScript)
    .addSignerKey(adminPkh)
    .chain();
console.log(`deploy refscripts tx built`);
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


const refscriptsRefUtxo: UTxO = derivedOutputs.find((utxo) => {
    if (utxo.assets[beaconTokens.refscripts]) return true;
    else return false;
}) as UTxO;

const settingsValRefUtxo: UTxO = derivedOutputs.find((utxo) => {
    if (utxo.assets[beaconTokens.settings]) return true;
    else return false;
}) as UTxO;

const vaultValRefUtxo: UTxO = derivedOutputs.find((utxo) => {
    if (utxo.assets[beaconTokens.vault]) return true;
    else return false;
}) as UTxO;

const protocolValRefUtxo: UTxO = derivedOutputs.find((utxo) => {
    if (utxo.assets[beaconTokens.protocol]) return true;
    else return false;
}) as UTxO;

const referenceUtxos = {
    refscripts: refscriptsRefUtxo,
    settings: settingsValRefUtxo,
    vault: vaultValRefUtxo,
    protocol: protocolValRefUtxo,
};

const results = {
    referenceUtxos,
    refscriptsPolicyID,
    refscriptsScriptAddr,
    settingsScriptAddr,
    vaultScriptAddr,
    protocolScriptAddr,
    beaconTokens,
};

const data = new TextEncoder().encode(stringify(results));
Deno.writeFileSync(deployDetailsFile, data);
console.log(`Results written to ${deployDetailsFile}`);
