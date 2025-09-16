import {
    emulator,
    adminPkh,
    provNetwork,
    demoS2MintingScript,
    deployed,
    getLucidInstance,
    getEmulatorInstance,
    makeVaultDatum,
    settingsBeaconTknName,    
    testLiveShuffleNFTs,
    testS2NFTs,
    s2PolicyId,
    RedeemerEnum,
    UnifiedRedeemer,
    UnifiedRedeemerType,
    VaultDatumType,
    VaultDatum,
    refTokensValidatorAddr,
    orderUtxosCanonically,
    USER_WALLET_SEED,
    ADMIN_WALLET_SEED
} from "../index.ts";
import { 
    Data, 
    Datum, 
    stringify, 
    getAddressDetails, 
    Credential,
    RedeemerBuilder,
 } from "@lucid-evolution/lucid";
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


if (provNetwork == "Custom") { // for Emulator testing
    await requestLiveShuffle();
    await fulfillLiveShuffle();

} else { // for live networks (preprod or mainnet)
    // liveshuffle request tx:
    if (Deno.args[1] == "request") await requestLiveShuffle();

    // liveshuffle fulfill tx:
    if (Deno.args[1] == "fulfill") await fulfillLiveShuffle();
}







export async function requestLiveShuffle(){
    // switch to user wallet:
    lucid.selectWallet.fromSeed(USER_WALLET_SEED);
    const userAddress = await lucid.wallet().address();
    const userPaymtCred = getAddressDetails(userAddress).paymentCredential as Credential;
    const userStakeCred = getAddressDetails(userAddress).stakeCredential as Credential;
    
    const reqDatumObj: VaultDatumType = {
        owner: {
            payment_credential: { VerificationKey: [userPaymtCred.hash] },
            stake_credential: { Inline: [{ VerificationKey: [userStakeCred.hash] }] },
        },
    };
    const reqDatum = makeVaultDatum(reqDatumObj);

    const tx = await lucid
        .newTx()
        .pay.ToContract(
            deployed.vaultScriptAddr,
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
    console.log(`Liveshuffle request tx submitted. Hash: ${txHash}`);

    // Simulate the passage of time and block confirmations
    if (provNetwork == "Custom") {
        await emulator.awaitBlock(10);
        console.log("emulated passage of 10 blocks..");
        console.log("");
    }
}

// To-do: refactor so that collateral will be returned to admin/tx maker
// and also all the remaining lovelace from the request utxo will be returned to user
export async function fulfillLiveShuffle(){
    // switch to user wallet:
    lucid.selectWallet.fromSeed(USER_WALLET_SEED);
    const userAddress = await lucid.wallet().address();

    // switch back to admin wallet:
    lucid.selectWallet.fromSeed(ADMIN_WALLET_SEED);

    const refUtxos = await lucid.utxosAt(deployed.refscriptsScriptAddr);
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
    const shuffleQty = Number(
        Object.entries(requestUtxo.assets).reduce(
            (accum, [assetId, amt]) => assetId.startsWith(s2PolicyId) ? accum += amt : accum, 0n
        )
    );

    const settingsUtxos = await lucid.utxosAt(deployed.settingsScriptAddr);
    const settingsUtxo = settingsUtxos.find((utxo) => {
        if (utxo.assets[deployed.settingsScriptHash + settingsBeaconTknName]) return true;
        else return false;
    })!;

    const protocolUtxos = await lucid.utxosAt(deployed.protocolScriptAddr);
    const protocolUtxo = protocolUtxos[0]; // pick 1, any will do

    // organize reference inputs
    const referenceInputs = [settingsUtxo, vaultRefUtxo, protocolRefUtxo];
    const refInputsIdxs = orderUtxosCanonically(referenceInputs);
    const settings_idx = refInputsIdxs.get(settingsUtxo.txHash + settingsUtxo.outputIndex)!;

    const liveShuffleRedeemer: RedeemerBuilder = {
        kind: "selected",
        inputs: [protocolUtxo, requestUtxo],
        makeRedeemer: (inputIdxs: bigint[]) => {
            const redeemer: UnifiedRedeemerType = {
                [RedeemerEnum.LiveShuffle]: {
                    protocol_idxs: [inputIdxs[0], 0n],
                    vault_idxs: [inputIdxs[1], 1n],
                    user_idx: 2n,
                    ref_idxs: [...Array(shuffleQty).keys()].map(idx => BigInt(3 + idx)), // indeces of cip68 ref outputs, starting from 3n
                    settings_idx: settings_idx,
                }
            };
            return Data.to(redeemer, UnifiedRedeemer);
        },
    };

    const assetsToMint = {
        [testLiveShuffleNFTs["HW S2 1069 Ref"]]: 1n,
        [testLiveShuffleNFTs["HW S2 1069 Usr"]]: 1n,
        [testLiveShuffleNFTs["HW S2 0069 Ref"]]: 1n,
        [testLiveShuffleNFTs["HW S2 0069 Usr"]]: 1n,
    };

    const tx = await lucid
        .newTx()
        .collectFrom([protocolUtxo, requestUtxo], liveShuffleRedeemer)
        .mintAssets(assetsToMint, Data.void())
        .pay.ToContract( // return protocol utxo
            deployed.protocolScriptAddr,
            { kind: "inline", value: protocolUtxo.datum as Datum },
            protocolUtxo.assets,
        )
        .pay.ToContract( // return contents of request utxo to vault
            deployed.vaultScriptAddr,
            undefined,
            requestUtxo.assets,
        )
        .pay.ToAddress( // minted cip 68 user tokens, to user address
            userAddress, 
            {
                "lovelace": 0n,
                [testLiveShuffleNFTs["HW S2 1069 Usr"]]: 1n,
                [testLiveShuffleNFTs["HW S2 0069 Usr"]]: 1n,
            },
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
        .readFrom(referenceInputs)
        .attach.Script(demoS2MintingScript)
        .addSignerKey(adminPkh) // added only for the minting nativescript reqt
        .complete();
    console.log(`LiveShuffle fulfill tx built.`);

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
    console.log(`LiveShuffle fulfill tx submitted. Hash: ${txHash}`);

    // Simulate the passage of time and block confirmations
    if (provNetwork == "Custom") {
        await emulator.awaitBlock(10);
        console.log("emulated passage of 10 blocks..");
        console.log("");
    }
}