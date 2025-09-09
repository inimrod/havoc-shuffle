import {
    adminPkh,
    deployed,
    getLucidInstance,
    makeSettingsDatum,
    protocolScriptAddr,
    protocolScriptHash,
    RedeemerEnum,
    s2PolicyId,
    settingsBeaconTknName,
    SettingsDatumObj,
    settingsPolicyID,
    settingsScriptAddr,
    UnifiedRedeemer,
    vaultScriptHash,
    refscriptsScriptHash,
    refTokensValidatorHash
} from "../index.ts";
import { Data, Datum, stringify } from "@lucid-evolution/lucid";

if (!deployed || !deployed.referenceUtxos) {
    console.log(`Reference UTXOs not yet deployed. Exiting...`);
    Deno.exit(0);
}

const lucid = getLucidInstance();

const refUtxos = await lucid.utxosAt(deployed.refscriptsScriptAddr);
const settingsRefUtxo = refUtxos.find((utxo) => {
    if (utxo.assets[deployed.beaconTokens.settings]) return true;
    else return false;
})!;

const cfgBeaconAsset = settingsPolicyID + settingsBeaconTknName;
const assetsToMint = {
    [cfgBeaconAsset]: 1n,
};
const mintCfgBeacon: UnifiedRedeemer = RedeemerEnum.MintBeaconToken;
const mintCfgBeaconRedeemer = Data.to(mintCfgBeacon, UnifiedRedeemer);

const cfgDatumObj: SettingsDatumObj = {
    refscripts: refscriptsScriptHash,
    reftokens: refTokensValidatorHash,
    vault: vaultScriptHash,
    protocol: protocolScriptHash,
    s2_policy_id: s2PolicyId,
    max_to_shuffle: 5n,
};
const cfgDatum = makeSettingsDatum(cfgDatumObj);
const tx = await lucid
    .newTx()
    .mintAssets(assetsToMint, mintCfgBeaconRedeemer)
    .pay.ToContract(
        settingsScriptAddr,
        { kind: "inline", value: cfgDatum as Datum },
        { [cfgBeaconAsset]: 1n },
    )
    .pay.ToContract(
        protocolScriptAddr,
        { kind: "inline", value: Data.void() },
    )
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
