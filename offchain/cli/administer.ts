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
    Datum,
    stringify,
    RedeemerBuilder
} from "@lucid-evolution/lucid";
import { initializeSettings } from "./settings-initialize.ts";
import { requestLiveShuffle, fulfillLiveShuffle } from "./liveshuffle.ts";

console.log(`Using network: ${provNetwork}`);
const lucid = provNetwork == "Custom" ? getEmulatorInstance() : getLucidInstance();
const adminAddress = await lucid.wallet().address();

// if using emulator, run initializeSettings() first
if (provNetwork == "Custom") {
    await initializeSettings();
}

if (!deployed || !deployed.referenceUtxos) {
    console.log(`Reference UTXOs not yet deployed. Exiting...`);
    Deno.exit(0);
}

if (provNetwork == "Custom") { // for Emulator testing
    await requestLiveShuffle();
    await fulfillLiveShuffle();
}


// main function
if (import.meta.main) {
    const refUtxos = await lucid.utxosAt(deployed.refscriptsScriptAddr);
    const vaultRefUtxo = refUtxos.find((utxo) => {
        if (utxo.assets[deployed.beaconTokens.vault]) return true;
        else return false;
    })!;
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


    // Vault contract UTXOs
    const vaultUtxos = await lucid.utxosAt(deployed.vaultScriptAddr);
    const adminVaultUtxo = vaultUtxos.find((utxo) => {
        if (utxo.address == deployed.vaultScriptAddr && !utxo.datum) return true;
        return false;
    })!;

    // organize reference inputs
    const referenceInputs = [settingsUtxo, vaultRefUtxo, protocolRefUtxo];
    const refInputsIdxs = orderUtxosCanonically(referenceInputs);
    const settings_idx = refInputsIdxs.get(settingsUtxo.txHash + settingsUtxo.outputIndex)!;

    const inputUtxos = [protocolUtxo, adminVaultUtxo];
    const administerRedeemer: RedeemerBuilder = {
        kind: "selected",
        inputs: inputUtxos,
        makeRedeemer: (inputIdxs: bigint[]) => {
            const redeemer: UnifiedRedeemerType = {
                [RedeemerEnum.Administer]: {
                    protocol_idxs: [inputIdxs[0], 0n],
                    settings_idx: settings_idx,
                }
            };
            return Data.to(redeemer, UnifiedRedeemer);
        },
    };

    const tx = await lucid
        .newTx()
        .collectFrom(inputUtxos, administerRedeemer)
        .pay.ToContract( // return protocol utxo
            deployed.protocolScriptAddr,
            { kind: "inline", value: protocolUtxo.datum as Datum },
            protocolUtxo.assets,
        )
        .pay.ToAddress( // destination of administered vault utxo
            adminAddress, 
            adminVaultUtxo.assets
        )
        .attachMetadata(674, { msg: ["Havoc Shuffle administer vault utxo"] })
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
    console.log(`Administer tx submitted. Hash: ${txHash}`);


    // Simulate the passage of time and block confirmations
    if (provNetwork == "Custom") {
        await emulator.awaitBlock(10);
        console.log("emulated passage of 10 blocks..");
        console.log("");
    }
}