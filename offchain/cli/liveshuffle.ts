import {
    emulator,
    provNetwork,
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
    ADMIN_WALLET_SEED,
    s2MintPolicyRefUtxo
} from "../index.ts";
import {
    UTxO,
    Data, 
    Datum, 
    stringify, 
    Credential,
    TxSignBuilder,
    RedeemerBuilder,
    makeTxSignBuilder,
    getAddressDetails,
 } from "@lucid-evolution/lucid";
import { initializeSettings } from "./settings-initialize.ts";


console.log(`Using network: ${provNetwork}`);
const lucid = provNetwork == "Custom" ? getEmulatorInstance() : getLucidInstance();

// run if this script is called directly from command line
if (import.meta.main) {
    console.log(`LiveShuffle cli script called directly from command line...`);
    console.log("");

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

    const assetsToVault: Record<string, bigint> = { "lovelace": 20_000_000n };
    for (const nft of testS2NFTs){
        assetsToVault[nft] = 1n;
    }

    const tx = await lucid
        .newTx()
        .pay.ToContract(
            deployed.vaultScriptAddr,
            { kind: "inline", value: reqDatum as Datum },
            assetsToVault,
        )
        .attachMetadata(674, { msg: ["Havoc Shuffle request live shuffle"] })
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


export async function fulfillLiveShuffle(){
    // switch to user wallet:
    lucid.selectWallet.fromSeed(USER_WALLET_SEED);
    const userAddress = await lucid.wallet().address();

    // switch s2 minter wallet:
    lucid.selectWallet.fromSeed(ADMIN_WALLET_SEED, {accountIndex: 1});
    const s2MinterAddress = await lucid.wallet().address();
    const minterPaymtCred = getAddressDetails(s2MinterAddress).paymentCredential as Credential;
    const minterPkh = minterPaymtCred.hash;

    // switch back to admin wallet:
    lucid.selectWallet.fromSeed(ADMIN_WALLET_SEED);

    // get collateral utxo from admin wallet:
    const adminUtxos = await lucid.wallet().getUtxos();
    const collateralUtxo = adminUtxos[0]; // just pick the first one

    const refUtxos = await lucid.utxosAt(deployed.refscriptsScriptAddr);
    const vaultRefUtxo = refUtxos.find((utxo) => {
        if (utxo.assets[deployed.beaconTokens.vault]) return true;
        else return false;
    })!;
    const protocolRefUtxo = refUtxos.find((utxo) => {
        if (utxo.assets[deployed.beaconTokens.protocol]) return true;
        else return false;
    })!;
    const s2PolicyRefUtxo = provNetwork == "Custom" 
        ? refUtxos.find((utxo) => {
            if (utxo.assets[deployed.beaconTokens.hvcS2Policy]) return true;
            else return false;
          })!
        : s2MintPolicyRefUtxo[provNetwork.toLowerCase()];

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
    const vaultAssetsToReturn = Object.assign({}, requestUtxo.assets); // copy of requestUtxo.assets;
    delete vaultAssetsToReturn.lovelace; // lovelace from request utxo will be returned to the user

    const settingsUtxos = await lucid.utxosAt(deployed.settingsScriptAddr);
    const settingsUtxo = settingsUtxos.find((utxo) => {
        if (utxo.assets[deployed.settingsScriptHash + settingsBeaconTknName]) return true;
        else return false;
    })!;

    const protocolUtxos = await lucid.utxosAt(deployed.protocolScriptAddr);
    const protocolUtxo = protocolUtxos[0]; // pick 1, any will do

    // organize reference inputs
    const referenceInputs = [settingsUtxo, vaultRefUtxo, protocolRefUtxo, s2PolicyRefUtxo];
    const refInputsIdxs = orderUtxosCanonically(referenceInputs);
    const settings_idx = refInputsIdxs.get(settingsUtxo.txHash + settingsUtxo.outputIndex)!;

    const inputUtxos = [protocolUtxo, requestUtxo, collateralUtxo];
    const liveShuffleRedeemer: RedeemerBuilder = {
        kind: "selected",
        inputs: inputUtxos,
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

    const assetsToMint = {} as Record<string, bigint>;
    for (const tknPair of testLiveShuffleNFTs){
        assetsToMint[tknPair.usr] = 1n;
        assetsToMint[tknPair.ref] = 1n;
    }

    async function buildLiveShuffleTx(userLovelace:bigint){
        const tx = lucid
            .newTx()
            .collectFrom(inputUtxos, liveShuffleRedeemer)
            .mintAssets(assetsToMint, Data.void())
            .pay.ToContract( // return protocol utxo
                deployed.protocolScriptAddr,
                { kind: "inline", value: protocolUtxo.datum as Datum },
                protocolUtxo.assets,
            )
            .pay.ToContract( // return tokens contained in request utxo to the vault
                deployed.vaultScriptAddr,
                undefined,
                vaultAssetsToReturn,
            );
        const assetsToUser: Record<string, bigint> = { "lovelace": userLovelace };
        for (const tknPair of testLiveShuffleNFTs){
            assetsToUser[tknPair.usr] = 1n;
        }
        tx.pay.ToAddress( // minted cip 68 user tokens, to user address
            userAddress, 
            assetsToUser
        );
        for (const tknPair of testLiveShuffleNFTs){
            tx.pay.ToContract( // minted cip 68 ref token
                refTokensValidatorAddr,
                { kind: "inline", value: Data.void() },
                {
                    [tknPair.ref]: 1n,
                },
            )
        }
        const [_newWalletInputs, derivedOutputs, txSignBuilder] = await tx
            .attachMetadata(674, { msg: ["Havoc Shuffle fulfill live shuffle"] })
            .readFrom(referenceInputs)
            .addSignerKey(minterPkh) // added for the s2 minting policy reqt
            .chain();

        return [txSignBuilder, derivedOutputs] as [TxSignBuilder, UTxO[]];
    }

    const [draftTx, derivedOutputs]  = await buildLiveShuffleTx(0n);
    console.log(`Draft liveShuffle fulfill tx built.`);
    const draftTxJson = JSON.parse(stringify(draftTx));
    const txFee = parseInt(draftTxJson.body.fee);
    const vaultReturnUtxo: UTxO = derivedOutputs.find((utxo) => {
        if (utxo.address == deployed.vaultScriptAddr) return true;
        else return false;
    }) as UTxO;
    const vaultReturnLovelace = Number(vaultReturnUtxo.assets.lovelace);
    const cip68RefUtxos: UTxO[] = derivedOutputs.filter((utxo) => {
        if (utxo.address == refTokensValidatorAddr) return true;
        else return false;
    });
    const cip68RefLovelace = cip68RefUtxos.reduce((accum, utxo) => accum + Number(utxo.assets.lovelace), 0);
    const finalLovelaceToUser = BigInt(Number(requestUtxo.assets.lovelace) - vaultReturnLovelace - cip68RefLovelace - txFee);

    const [finalTx, _derivedOutputs] = await buildLiveShuffleTx(finalLovelaceToUser);
    console.log(`Final liveShuffle fulfill tx built, with ${finalLovelaceToUser} lovelace to user.`);

    // sign with s2 minter key:
    lucid.selectWallet.fromSeed(ADMIN_WALLET_SEED, {accountIndex: 1});
    const s2MinterWitness = await makeTxSignBuilder(lucid.wallet(), finalTx.toTransaction()).partialSign.withWallet();
    console.log(`Done signing with s2 minter key.`);

    // sign with admin key:
    const signedTx = await finalTx.assemble([s2MinterWitness]).sign.withWallet().complete();
    console.log(`Done signing with admin key.`);
    console.log(`signedTx: ${stringify(signedTx)}`);
    console.log(`signedTx hash: ${signedTx.toHash()}`);
    console.log(`size: ~${signedTx.toCBOR().length / 2048} KB`);

    console.log("");
    const txJson = JSON.parse(stringify(signedTx));
    console.log(`ADA in request: ${requestUtxo.assets.lovelace}`);
    console.log(`txFee: ${parseInt(txJson.body.fee) / 1_000_000} ADA`);
    console.log(`txFee: ${txFee} lovelace`);
    console.log(`vaultReturnLovelace: ${vaultReturnLovelace}`);
    console.log(`cip68RefLovelace: ${cip68RefLovelace} (total)`);
    console.log(`ADA in finalTx: ${finalLovelaceToUser}`);
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