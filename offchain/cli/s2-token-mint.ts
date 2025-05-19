import { adminPkh, demoS2MintingScript, deployed, getLucidInstance, provNetwork, testS2NFTs } from "../index.ts";
import { Data, stringify } from "@lucid-evolution/lucid";

if (!deployed || !deployed.referenceUtxos) {
    console.log(`Reference UTXOs not yet deployed. Exiting...`);
    Deno.exit(0);
}

if (provNetwork == "Mainnet") {
    console.log(`Can't mint like this on mainnet. Exiting...`);
    Deno.exit(0);
}

const lucid = getLucidInstance();

const assetsToMint = {
    [testS2NFTs["HW S2 0999"]]: 1n,
    [testS2NFTs["HW S2 1000"]]: 1n,
};
const tx = await lucid
    .newTx()
    .mintAssets(assetsToMint, Data.void())
    .addSignerKey(adminPkh)
    .attach.Script(demoS2MintingScript)
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
