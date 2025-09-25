import { 
    getLucidInstance,
    provNetwork, 
    USER_WALLET_SEED,
    ADMIN_WALLET_SEED,
    s2MintPolicyRefUtxo,
    testLiveShuffleNFTs,
    s2RefTokensValRefUtxo,
    refTokensValidatorAddr,
} from "../index.ts";
import { 
    Data, 
    stringify, 
    Credential,
    makeTxSignBuilder,
    getAddressDetails } from "@lucid-evolution/lucid";

console.log(`Using network: ${provNetwork}`);
if (provNetwork == "Mainnet" || provNetwork == "Custom") {
    console.log(`Can't mint like this on ${provNetwork}. Exiting...`);
    Deno.exit(0);
}

const lucid = getLucidInstance();

// switch to s2 minter wallet:
lucid.selectWallet.fromSeed(ADMIN_WALLET_SEED, {accountIndex: 1});
const s2MinterAddress = await lucid.wallet().address();
const minterPaymtCred = getAddressDetails(s2MinterAddress).paymentCredential as Credential;
const minterPkh = minterPaymtCred.hash;

// switch to user wallet:
lucid.selectWallet.fromSeed(USER_WALLET_SEED);

const assetsToBurn = {} as Record<string, bigint>;
for (const nft of testLiveShuffleNFTs){
    assetsToBurn[nft.ref] = -1n;
    assetsToBurn[nft.usr] = -1n;
}

const refTokensUtxos = (await lucid.utxosAt(refTokensValidatorAddr)).filter(utxo => {
    for (const nft of testLiveShuffleNFTs){
        if (utxo.assets[nft.ref]) return true;
    }
    return false;
});

const tx = await lucid
    .newTx()
    .mintAssets(assetsToBurn, Data.void())
    .collectFrom(refTokensUtxos, Data.void())
    .addSignerKey(minterPkh) // s2 minting policy reqt
    .attachMetadata(674, { msg: ["Havoc Shuffle burn test s2 nfts"] })
    .readFrom([s2MintPolicyRefUtxo.preprod, s2RefTokensValRefUtxo.preprod])
    .complete();

// sign with s2 minter key:
lucid.selectWallet.fromSeed(ADMIN_WALLET_SEED, {accountIndex: 1});
const s2MinterWitness = await makeTxSignBuilder(lucid.wallet(), tx.toTransaction()).partialSign.withWallet();
console.log(`Done signing with s2 minter key.`);

// sign with user key:
const signedTx = await tx.assemble([s2MinterWitness]).sign.withWallet().complete();
console.log(`Done signing with user key.`);
console.log(`signedTx: ${stringify(signedTx)}`);
console.log(`signedTx hash: ${signedTx.toHash()}`);
console.log(`size: ~${signedTx.toCBOR().length / 2048} KB`);

console.log("");
const txJson = JSON.parse(stringify(signedTx));
console.log(`txFee: ${parseInt(txJson.body.fee) / 1_000_000} ADA`);
console.log("");

const txHash = await signedTx.submit();
console.log(`Burn test S2 NFTs tx submitted. Hash: ${txHash}`);
