import { 
    adminPkh, 
    demoS2MintingScript, 
    emulator, 
    getLucidInstance,
    getEmulatorInstance,
    provNetwork, 
    testS2NFTs 
} from "../index.ts";
import { Data, stringify } from "@lucid-evolution/lucid";

console.log(`Using network: ${provNetwork}`);
if (provNetwork == "Mainnet") {
    console.log(`Can't mint like this on mainnet. Exiting...`);
    Deno.exit(0);
}

const lucid = provNetwork == "Custom" ? getEmulatorInstance() : getLucidInstance();

const assetsToMint = {
    [testS2NFTs[0]]: 1n,
    [testS2NFTs[1]]: 1n,
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

// Simulate the passage of time and block confirmations
if (provNetwork == "Custom") {
    await emulator.awaitBlock(10);
    console.log("emulated passage of 10 blocks..");
    console.log("");
}
