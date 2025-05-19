import {
    deployed,
    getLucidInstance,
    RedeemerType,
    settingsBeaconTknName,
    settingsPolicyID,
    UnifiedRedeemer,
    VaultDatum,
    vaultScriptRewardAddr,
    
    USER_WALLET_SEED
} from "../index.ts";
import { Data, stringify, Datum, getAddressDetails, Credential } from "@lucid-evolution/lucid";

if (!deployed || !deployed.referenceUtxos) {
    console.log(`Reference UTXOs not yet deployed. Exiting...`);
    Deno.exit(0);
}

const lucid = getLucidInstance();

// switch to user wallet:
lucid.selectWallet.fromSeed(USER_WALLET_SEED);
const userAddress = await lucid.wallet().address();
const userPaymtCred = getAddressDetails(userAddress).paymentCredential as Credential;

// Reference scripts UTXOs
const refUtxos = await lucid.utxosAt(deployed.refscriptsScriptAddr);
const settingsRefUtxo = refUtxos.find((utxo) => {
    if (utxo.assets[deployed.beaconTokens.settings]) return true;
    else return false;
})!;
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
    if (utxo.assets[settingsPolicyID + settingsBeaconTknName]) return true;
    else return false;
})!;
const readSettings: UnifiedRedeemer = RedeemerType.ReadSettings;
const readSettingsRedeemer = Data.to(readSettings, UnifiedRedeemer);

// Protocol contract UTXOs
const protocolUtxos = await lucid.utxosAt(deployed.protocolScriptAddr);
const protocolUtxo = protocolUtxos[0]; // pick 1, any will do
const cancelShuffle: UnifiedRedeemer = RedeemerType.CancelShuffle;
const cancelShuffleRedeemer = Data.to(cancelShuffle, UnifiedRedeemer);

// extra user utxo:
// const userInput = {
//     txHash: "ae87e65fa0b71f938383aa299acdc739a1b9d296a6929df1588d62ca8b6f1b27",
//     outputIndex: 2,
//     address: userAddress,
//     assets: { "lovelace": 115914319n }
// }

const tx = await lucid
    .newTx()
    .collectFrom([requestUtxo], Data.void())
    .collectFrom([settingsUtxo], readSettingsRedeemer)
    .collectFrom([protocolUtxo], cancelShuffleRedeemer)
    // .collectFrom([userInput])
    .withdraw(vaultScriptRewardAddr, 0n, Data.void())
    .pay.ToContract( // return settings utxo
        deployed.settingsScriptAddr,
        { kind: "inline", value: settingsUtxo.datum as Datum },
        settingsUtxo.assets,
    )
    .pay.ToContract( // return protocol utxo
        deployed.protocolScriptAddr,
        { kind: "inline", value: protocolUtxo.datum as Datum },
        protocolUtxo.assets,
    )
    // .pay.ToAddress( // return assets from request, back to user
    //     userAddress, 
    //     requestUtxo.assets
    // )
    .addSignerKey(userPaymtCred.hash) // added to satisfy protocol reqt for CancelShuffle redeemer
    .readFrom([settingsRefUtxo, vaultRefUtxo, protocolRefUtxo])
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
console.log(`tx submitted. Hash: ${txHash}`);
