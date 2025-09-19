import {
    emulator,
    deployed,
    VaultDatum,
    provNetwork,
    RedeemerEnum,
    UnifiedRedeemer,
    getLucidInstance,
    USER_WALLET_SEED,
    getEmulatorInstance,
    UnifiedRedeemerType,
    orderUtxosCanonically,
    settingsBeaconTknName    
} from "../index.ts";
import { 
    Data,
    Datum,
    stringify,
    Credential,
    RedeemerBuilder,
    getAddressDetails,
} from "@lucid-evolution/lucid";
import { initializeSettings } from "./settings-initialize.ts";
import { requestLiveShuffle } from "./liveshuffle.ts";

console.log(`Using network: ${provNetwork}`);
const lucid = provNetwork == "Custom" ? getEmulatorInstance() : getLucidInstance();

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
}



// switch to user wallet:
lucid.selectWallet.fromSeed(USER_WALLET_SEED);
const userAddress = await lucid.wallet().address();
const userPaymtCred = getAddressDetails(userAddress).paymentCredential as Credential;

// Reference scripts UTXOs
const refUtxos = await lucid.utxosAt(deployed.refscriptsScriptAddr);
const vaultRefUtxo = refUtxos.find((utxo) => {
    if (utxo.assets[deployed.beaconTokens.vault]) return true;
    else return false;
})!;
const protocolRefUtxo = refUtxos.find((utxo) => {
    if (utxo.assets[deployed.beaconTokens.protocol]) return true;
    else return false;
})!;



// Vault contract UTXOs
const vaultUtxos = await lucid.utxosAt(deployed.vaultScriptAddr);
const requestUtxo = vaultUtxos.find((utxo) => {
    if (!utxo.datum) return false;
    const datum = Data.from(utxo.datum, VaultDatum);
    if (datum.owner) return true;
    return false;
})!;
console.log(`requestUtxo: ${stringify(requestUtxo)}`);

// Settings contract UTXOs
const settingsUtxos = await lucid.utxosAt(deployed.settingsScriptAddr);
const settingsUtxo = settingsUtxos.find((utxo) => {
    if (utxo.assets[deployed.settingsScriptHash + settingsBeaconTknName]) return true;
    else return false;
})!;

// Protocol contract UTXOs
const protocolUtxos = await lucid.utxosAt(deployed.protocolScriptAddr);
const protocolUtxo = protocolUtxos[0]; // pick 1, any will do

// organize reference inputs
const referenceInputs = [settingsUtxo, vaultRefUtxo, protocolRefUtxo];
const refInputsIdxs = orderUtxosCanonically(referenceInputs);
const settings_idx = refInputsIdxs.get(settingsUtxo.txHash + settingsUtxo.outputIndex)!;

const inputUtxos = [protocolUtxo, requestUtxo];
const cancelShuffleRedeemer: RedeemerBuilder = {
    kind: "selected",
    inputs: inputUtxos,
    makeRedeemer: (inputIdxs: bigint[]) => {
        const redeemer: UnifiedRedeemerType = {
            [RedeemerEnum.CancelShuffle]: {
                protocol_idxs: [inputIdxs[0], 0n],
                settings_idx: settings_idx,
                request_idx: inputIdxs[1],
                user_idx: 1n                
            }
        };
        return Data.to(redeemer, UnifiedRedeemer);
    },
};

const tx = await lucid
    .newTx()
    .collectFrom(inputUtxos, cancelShuffleRedeemer)
    .pay.ToContract( // return protocol utxo
        deployed.protocolScriptAddr,
        { kind: "inline", value: protocolUtxo.datum as Datum },
        protocolUtxo.assets,
    )
    .pay.ToAddress( // return assets from request, back to user
        userAddress, 
        requestUtxo.assets
    )
    .attachMetadata(674, { msg: ["Havoc Shuffle cancel shuffle request"] })
    .addSignerKey(userPaymtCred.hash) // added to satisfy protocol reqt for CancelShuffle redeemer
    .readFrom(referenceInputs)
    .complete({changeAddress: userAddress});

// sign by user:
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
console.log(`Cancel Shuffle tx submitted. Hash: ${txHash}`);


// Simulate the passage of time and block confirmations
if (provNetwork == "Custom") {
    await emulator.awaitBlock(10);
    console.log("emulated passage of 10 blocks..");
    console.log("");
}