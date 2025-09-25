import { 
    adminPkh, 
    getLucidInstance,
    provNetwork, 
    testS2NFTs,
    s2MintPolicyRefUtxo
} from "../index.ts";
import { Data, stringify } from "@lucid-evolution/lucid";

console.log(`Using network: ${provNetwork}`);
if (provNetwork == "Mainnet" || provNetwork == "Custom") {
    console.log(`Can't mint like this on ${provNetwork}. Exiting...`);
    Deno.exit(0);
}

const lucid = getLucidInstance();

const assetsToMint = {
    [testS2NFTs[0]]: 1n,
    [testS2NFTs[1]]: 1n,
};
const tx = await lucid
    .newTx()
    .mintAssets(assetsToMint, Data.void())
    .addSignerKey(adminPkh)
    .attachMetadata(674, { msg: ["Havoc Shuffle test mint s2 nfts"] })
    .readFrom([s2MintPolicyRefUtxo.preprod])
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
console.log(`Mint test S2 NFTs tx submitted. Hash: ${txHash}`);
