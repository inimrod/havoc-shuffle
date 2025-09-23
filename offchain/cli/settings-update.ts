import {
    adminPkh,
    deployed,
    emulator,
    s2PolicyId,
    provNetwork,
    RedeemerEnum,
    UnifiedRedeemer,
    getLucidInstance,
    SettingsDatumType,
    makeSettingsDatum,
    deployDetailsFile,
    getEmulatorInstance,
    UnifiedRedeemerType,
    refscriptsScriptHash,
    parseStringifiedUtxo,
    settingsBeaconTknName,    
    refTokensValidatorHash    
} from "../index.ts";
import { Data, Datum, UTxO, stringify, RedeemerBuilder } from "@lucid-evolution/lucid";
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
const settingsUtxos = deployed.settingsUtxo
    ? [parseStringifiedUtxo(deployed.settingsUtxo)]
    : await lucid.utxosAt(deployed.settingsScriptAddr);
const settingsUtxo = settingsUtxos.find((utxo) => {
    if (utxo.assets[cfgBeaconAsset]) return true;
    else return false;
})!;

// new settings datum
const cfgDatumObj: SettingsDatumType = {
    admin: adminPkh,
    refscripts: refscriptsScriptHash,
    reftokens: refTokensValidatorHash,
    vault: deployed.vaultScriptHash,
    protocol: deployed.protocolScriptHash,
    s2_policy_id: s2PolicyId,
    max_to_shuffle: 4n,
};
const cfgDatum = makeSettingsDatum(cfgDatumObj);

// spend redeemer
const settingsUpdateRedeemer: RedeemerBuilder = {
    kind: "selected",
    inputs: [settingsUtxo],
    makeRedeemer: (inputIdxs: bigint[]) => {
        const redeemer: UnifiedRedeemerType = {
            [RedeemerEnum.UpdateSettings]: {
                input_idx: inputIdxs[0],
                output_idx: 0n
            },
        };
        return Data.to(redeemer, UnifiedRedeemer);
    },
};


const [_newWalletInputs, derivedOutputs, tx] = await lucid
    .newTx()
    .collectFrom([settingsUtxo], settingsUpdateRedeemer)
    .pay.ToContract(
        deployed.settingsScriptAddr,
        { kind: "inline", value: cfgDatum as Datum },
        settingsUtxo.assets,
    )
    .attachMetadata(674, { msg: ["Havoc Shuffle update settings"] })
    .addSignerKey(adminPkh)
    .readFrom([settingsRefUtxo])
    .chain();

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
console.log(`Update settings tx submitted. Hash: ${txHash}`);

// Simulate the passage of time and block confirmations
if (provNetwork == "Custom") {
    await emulator.awaitBlock(10);
    console.log("emulated passage of 10 blocks..");
    console.log("");
}

const updatedSettingsUtxo: UTxO = derivedOutputs.find((utxo) => {
    if (utxo.assets[cfgBeaconAsset]) return true;
    else return false;
}) as UTxO;

// update the in-memory deployed details
deployed.settingsUtxo = updatedSettingsUtxo;

// update in-file deployed details
const data = new TextEncoder().encode(stringify(deployed));
Deno.writeFileSync(deployDetailsFile, data);
console.log(`Results written to ${deployDetailsFile}`);
console.log("");