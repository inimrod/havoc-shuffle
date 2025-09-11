import {
    adminPkh,
    beaconTokens,
    deployDetailsFile,
    deployed,
    getLucidInstance,
    getEmulatorInstance,
    emulator,
    provNetwork,
    refscriptsPolicyID,
    refscriptsRewardAddr,
    refscriptsScript,
    refscriptsScriptAddr,
    buildSettingsScript,
    buildVaultScript,
    buildProtocolScript,
} from "../index.ts";
import { Data, stringify, UTxO } from "@lucid-evolution/lucid";

// Avoid re-deploying if already done
if (deployed && deployed.referenceUtxos) {
    console.log(`Reference UTXOs already deployed. Exiting...`);
    Deno.exit(0);
}

console.log(`Using network: ${provNetwork}`);
const lucid = provNetwork == "Custom" ? getEmulatorInstance() : getLucidInstance();

if (provNetwork == "Custom") {
    console.log("When using Lucid Emulator ('Custom' network), you need to import and call the function `deployRescripts()` from your main task script.");
} else { 
    await deployRescripts();
}



export async function deployRescripts(){
    // The following actions are already combined here:
    // 1. mint beacon tokens for the refscripts
    // 2. deploy compiled refscripts into UTXOs with beacon tokens

    const initUtxos = (await lucid.wallet().getUtxos());
    const deployUtxo = initUtxos[0];
    const settingsInitUtxo = initUtxos[1];

    const settings = buildSettingsScript({
        transaction_id: settingsInitUtxo.txHash,
        output_index: BigInt(settingsInitUtxo.outputIndex)
    });
    const vault = buildVaultScript(settings.ScriptHash);
    const protocol = buildProtocolScript(settings.ScriptHash);

    const assetsToMint = {
        [beaconTokens.refscripts]: 1n,
        [beaconTokens.settings]: 1n,
        [beaconTokens.vault]: 1n,
        [beaconTokens.protocol]: 1n,
    };
    const [_newWalletInputs, derivedOutputs, tx] = await lucid
        .newTx()
        .collectFrom([deployUtxo])
        .mintAssets(assetsToMint, Data.void())
        .register.Stake(refscriptsRewardAddr)
        .pay.ToContract(
            refscriptsScriptAddr,
            { kind: "inline", value: Data.void() },
            { [beaconTokens.refscripts]: 1n },
            refscriptsScript,
        )
        .pay.ToContract(
            refscriptsScriptAddr,
            { kind: "inline", value: Data.void() },
            { [beaconTokens.settings]: 1n },
            settings.Script,
        )
        .pay.ToContract(
            refscriptsScriptAddr,
            { kind: "inline", value: Data.void() },
            { [beaconTokens.vault]: 1n },
            vault.Script,
        )
        .pay.ToContract(
            refscriptsScriptAddr,
            { kind: "inline", value: Data.void() },
            { [beaconTokens.protocol]: 1n },
            protocol.Script,
        )
        .attach.Script(refscriptsScript)
        .addSignerKey(adminPkh)
        .chain();
    console.log(`deploy refscripts tx built`);
    const signedTx = await tx.sign.withWallet().complete();
    console.log(`signedTx: ${stringify(signedTx)}`);
    console.log(`signedTx hash: ${signedTx.toHash()}`);
    console.log(`size: ~${signedTx.toCBOR().length / 2048} KB`);
    console.log("");

    console.log("");
    const txJson = JSON.parse(stringify(signedTx));
    console.log(`txFee: ${parseInt(txJson.body.fee) / 1_000_000} ADA`);
    console.log("");
    // Deno.exit(0);
    const txHash = await signedTx.submit();
    console.log(`tx submitted. Hash: ${txHash}`);
    console.log("");

    // Simulate the passage of time and block confirmations
    if (provNetwork == "Custom") {
        await emulator.awaitBlock(10);
        console.log("emulated passage of 10 blocks..");
        console.log("");
    }

    const refscriptsRefUtxo: UTxO = derivedOutputs.find((utxo) => {
        if (utxo.assets[beaconTokens.refscripts]) return true;
        else return false;
    }) as UTxO;

    const settingsValRefUtxo: UTxO = derivedOutputs.find((utxo) => {
        if (utxo.assets[beaconTokens.settings]) return true;
        else return false;
    }) as UTxO;

    const vaultValRefUtxo: UTxO = derivedOutputs.find((utxo) => {
        if (utxo.assets[beaconTokens.vault]) return true;
        else return false;
    }) as UTxO;

    const protocolValRefUtxo: UTxO = derivedOutputs.find((utxo) => {
        if (utxo.assets[beaconTokens.protocol]) return true;
        else return false;
    }) as UTxO;

    const referenceUtxos = {
        refscripts: refscriptsRefUtxo,
        settings: settingsValRefUtxo,
        vault: vaultValRefUtxo,
        protocol: protocolValRefUtxo,
    };

    const results = {
        referenceUtxos,
        refscriptsPolicyID,
        refscriptsScriptAddr,
        settingsInitUtxo: settingsInitUtxo,
        settingsScriptHash: settings.ScriptHash,
        settingsScriptAddr: settings.ScriptAddr,
        vaultScriptHash: vault.ScriptHash,
        vaultScriptAddr: vault.ScriptAddr,
        protocolScriptHash: protocol.ScriptHash,
        protocolScriptAddr: protocol.ScriptAddr,
        beaconTokens,
    };

    const data = new TextEncoder().encode(stringify(results));
    Deno.writeFileSync(deployDetailsFile, data);
    console.log(`Results written to ${deployDetailsFile}`);
    console.log("");

    // update the in-memory deployed details too
    deployed.referenceUtxos = referenceUtxos;
    deployed.refscriptsPolicyID = refscriptsPolicyID;
    deployed.refscriptsScriptAddr = refscriptsScriptAddr;
    deployed.settingsInitUtxo = settingsInitUtxo;
    deployed.settingsScriptHash = settings.ScriptHash;
    deployed.settingsScriptAddr = settings.ScriptAddr;
    deployed.vaultScriptHash = vault.ScriptHash;
    deployed.vaultScriptAddr = vault.ScriptAddr;
    deployed.protocolScriptHash = protocol.ScriptHash;
    deployed.protocolScriptAddr = protocol.ScriptAddr;
    deployed.beaconTokens = beaconTokens;
}


export async function prepInitUtxos(){
    // To be used in Emulator env only
    // Get the deployer account's first UTXO and split it into 2 UTXOs.
    // One will be used for deploying the reference scripts, and the other for initializing the settings.

    if (provNetwork !== "Custom") {
        console.log("prepInitUtxos() should only be called in Emulator env. Exiting...");
        Deno.exit(0);
    }

    const deployerAddr = await lucid.wallet().address();
    const tx = await lucid
        .newTx()
        .pay.ToAddress(deployerAddr, { lovelace: 500_000_000n })
        // the rest of the funds will go to the second UTXO as "change" output
        .complete();    
    const signedTx = await tx.sign.withWallet().complete();    
    const txHash = await signedTx.submit();

    // Simulate the passage of time and block confirmations    
    await emulator.awaitBlock(10);
    
    console.log("First UTXO in deployer account has been split into 2. Hash:", txHash);
    console.log("");
}