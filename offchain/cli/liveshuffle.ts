import {
    adminAddress,
    adminPkh,
    adminSpendPkh,
    beaconTokens,
    demoS2MintingScript,
    deployDetailsFile,
    deployed,
    getLucidInstance,
    makeVaultDatum,
    prefix_222,
    protocolScriptAddr,
    RedeemerType,
    refscriptsScriptAddr,
    s2PolicyId,
    settingsBeaconTknName,
    settingsPolicyID,
    settingsScriptAddr,
    testLiveShuffleNFTs,
    testS2NFTs,
    UnifiedRedeemer,
    VaultDatumObj,
    VaultDatum,
    vaultScriptAddr,
    vaultScriptRewardAddr,
    refTokensValidatorAddr,
    USER_WALLET_SEED
} from "../index.ts";
import { Data, Datum, fromText, stringify, getAddressDetails, Credential,
    calculateMinLovelaceFromUTxO,
    UTxO
 } from "@lucid-evolution/lucid";

if (!deployed || !deployed.referenceUtxos) {
    console.log(`Reference UTXOs not yet deployed. Exiting...`);
    Deno.exit(0);
}

const lucid = getLucidInstance();



// ------------------------
// liveshuffle request tx:
// ------------------------
if (Deno.args[1] == "request") {

    // switch to user wallet:
    lucid.selectWallet.fromSeed(USER_WALLET_SEED);
    const userAddress = await lucid.wallet().address();
    const userPaymtCred = getAddressDetails(userAddress).paymentCredential as Credential;
    const userStakeCred = getAddressDetails(userAddress).stakeCredential as Credential;
    
    const reqDatumObj: VaultDatumObj = {
        owner: {
            payment_credential: { VerificationKey: [userPaymtCred.hash] },
            stake_credential: { Inline: [{ VerificationKey: [userStakeCred.hash] }] },
        },
    };
    const reqDatum = makeVaultDatum(reqDatumObj);

    const tx = await lucid
        .newTx()
        .pay.ToContract(
            vaultScriptAddr,
            { kind: "inline", value: reqDatum as Datum },
            {
                "lovelace": 20_000_000n,
                [testS2NFTs["HW S2 0999"]]: 1n,
                [testS2NFTs["HW S2 1000"]]: 1n,
            },
        )
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
}




// ------------------------
// liveshuffle fulfill tx:
// ------------------------
if (Deno.args[1] == "fulfill") {
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

    const vaultUtxos = await lucid.utxosAt(deployed.vaultScriptAddr);
    const requestUtxo = vaultUtxos.find((utxo) => {
        if (!utxo.datum) return false;
        const datum = Data.from(utxo.datum, VaultDatum);
        if (datum.owner) return true;
        return false;
    })!;

    const settingsUtxos = await lucid.utxosAt(deployed.settingsScriptAddr);
    const settingsUtxo = settingsUtxos.find((utxo) => {
        if (utxo.assets[settingsPolicyID + settingsBeaconTknName]) return true;
        else return false;
    })!;
    const readSettings: UnifiedRedeemer = RedeemerType.ReadSettings;
    const readSettingsRedeemer = Data.to(readSettings, UnifiedRedeemer);

    const protocolUtxos = await lucid.utxosAt(deployed.protocolScriptAddr);
    const protocolUtxo = protocolUtxos[0]; // pick 1, any will do
    const liveShuffle: UnifiedRedeemer = RedeemerType.LiveShuffle;
    const liveShuffleRedeemer = Data.to(liveShuffle, UnifiedRedeemer);

    const assetsToMint = {
        [testLiveShuffleNFTs["HW S2 1069 Ref"]]: 1n,
        [testLiveShuffleNFTs["HW S2 1069 Usr"]]: 1n,
        [testLiveShuffleNFTs["HW S2 0069 Ref"]]: 1n,
        [testLiveShuffleNFTs["HW S2 0069 Usr"]]: 1n,
    };
    

    // test user acct: Daeda Testnet 1 0-00
    const userAddress = "addr_test1qrpfe4qwyqn5pfsqa5r0j2jns7tgl46e88vz98frtfetvznss90saju9nsk990e9s5qw5r5dze3cgrfglcx9yxt5tv5sce9tga";

    const tx = await lucid
        .newTx()
        .collectFrom([requestUtxo], Data.void())
        .collectFrom([settingsUtxo], readSettingsRedeemer)
        .collectFrom([protocolUtxo], liveShuffleRedeemer)
        .withdraw(vaultScriptRewardAddr, 0n, Data.void())
        .mintAssets(assetsToMint, Data.void())
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
        .pay.ToContract( // minted cip 68 ref token
            refTokensValidatorAddr,
            { kind: "inline", value: Data.void() },
            {
                [testLiveShuffleNFTs["HW S2 1069 Ref"]]: 1n,
            },
        )
        .pay.ToContract( // minted cip 68 ref token
            refTokensValidatorAddr,
            { kind: "inline", value: Data.void() },
            {
                [testLiveShuffleNFTs["HW S2 0069 Ref"]]: 1n,
            },
        )
        .pay.ToAddress(
            userAddress, // minted cip 68 user tokens, to user address
            {
                "lovelace": 0n,
                [testLiveShuffleNFTs["HW S2 1069 Usr"]]: 1n,
                [testLiveShuffleNFTs["HW S2 0069 Usr"]]: 1n,
            },
        )
        .readFrom([settingsRefUtxo, vaultRefUtxo, protocolRefUtxo])
        .attach.Script(demoS2MintingScript)
        .addSignerKey(adminPkh) // added only for the minting nativescript reqt
        .complete({changeAddress: vaultScriptAddr});

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
}
