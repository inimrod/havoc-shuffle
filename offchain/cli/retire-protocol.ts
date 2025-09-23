import {
    adminPkh,
    emulator,
    deployed,
    provNetwork,
    RedeemerEnum,
    UnifiedRedeemer,
    getLucidInstance,
    getEmulatorInstance,
    UnifiedRedeemerType,
    orderUtxosCanonically,
    settingsBeaconTknName
} from "../index.ts";
import { 
    Data,
    stringify,
    RedeemerBuilder
} from "@lucid-evolution/lucid";
import { initializeSettings } from "./settings-initialize.ts";

console.log(`Using network: ${provNetwork}`);
const lucid = provNetwork == "Custom" ? getEmulatorInstance() : getLucidInstance();


// main function
if (import.meta.main) {
    if (provNetwork == "Custom") { // if using emulator, run initializeSettings() first
        await initializeSettings();
    }

    if (!deployed || !deployed.referenceUtxos) {
        console.log(`Reference UTXOs not yet deployed. Exiting...`);
        Deno.exit(0);
    }

    await retireProtocol();
}

export async function retireProtocol() {
    const refUtxos = await lucid.utxosAt(deployed.refscriptsScriptAddr);
    const protocolRefUtxo = refUtxos.find((utxo) => {
        if (utxo.assets[deployed.beaconTokens.protocol]) return true;
        else return false;
    })!;

    const settingsUtxos = await lucid.utxosAt(deployed.settingsScriptAddr);
    const settingsUtxo = settingsUtxos.find((utxo) => {
        if (utxo.assets[deployed.settingsScriptHash + settingsBeaconTknName]) return true;
        else return false;
    })!;

    const protocolUtxos = await lucid.utxosAt(deployed.protocolScriptAddr);
    const protocolUtxo = protocolUtxos[0]; // pick 1, any will do


    // organize reference inputs
    const referenceInputs = [settingsUtxo, protocolRefUtxo];
    const refInputsIdxs = orderUtxosCanonically(referenceInputs);
    const settings_idx = refInputsIdxs.get(settingsUtxo.txHash + settingsUtxo.outputIndex)!;

    const inputUtxos = [protocolUtxo];
    const retireProtocolRedeemer: RedeemerBuilder = {
        kind: "selected",
        inputs: inputUtxos,
        makeRedeemer: (inputIdxs: bigint[]) => {
            const redeemer: UnifiedRedeemerType = {
                [RedeemerEnum.RetireProtocol]: {
                    protocol_idx: inputIdxs[0],
                    settings_idx: settings_idx,
                }
            };
            return Data.to(redeemer, UnifiedRedeemer);
        },
    };

    const tx = await lucid
        .newTx()
        .collectFrom(inputUtxos, retireProtocolRedeemer)
        .attachMetadata(674, { msg: ["Havoc Shuffle retire protocol"] })
        .addSignerKey(adminPkh) // added to satisfy protocol reqt for Administer redeemer
        .readFrom(referenceInputs)
        .complete();

    // sign by admin:
    const signedTx = await tx.sign.withWallet().complete();
    console.log(`signedTx: ${stringify(signedTx)}`);
    console.log(`signedTx hash: ${signedTx.toHash()}`);
    console.log(`size: ~${signedTx.toCBOR().length / 2048} KB`);

    console.log("");
    const txJson = JSON.parse(stringify(signedTx));
    console.log(`txFee: ${parseInt(txJson.body.fee) / 1_000_000} ADA`);
    console.log("");

    const txHash = await signedTx.submit();
    console.log(`Retire protocol tx submitted. Hash: ${txHash}`);


    // Simulate the passage of time and block confirmations
    if (provNetwork == "Custom") {
        await emulator.awaitBlock(10);
        console.log("emulated passage of 10 blocks..");
        console.log("");
    }
}