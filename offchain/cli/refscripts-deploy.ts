import {
    adminPkh,
    beaconTokens,
    deployDetailsFile,
    deployed,
    getLucidInstance,
    getEmulatorInstance,
    emulator,
    provNetwork,
    s2PolicyId,
    s2MintingScript,
    refscriptsPolicyID,
    refscriptsRewardAddr,
    refscriptsScript,
    refscriptsScriptAddr,
    buildSettingsScript,
    buildVaultScript,
    buildProtocolScript,
    s2MintPolicyRefUtxo
} from "../index.ts";
import { Data, stringify, UTxO } from "@lucid-evolution/lucid";

const lucid = provNetwork == "Custom" ? getEmulatorInstance() : getLucidInstance();

// run if this script is called directly from command line
if (import.meta.main) {
    console.log(`Using network: ${provNetwork}`);
    if (deployed && deployed.referenceUtxos) { // Avoid re-deploying if already done
        console.log(`Reference UTXOs already deployed. Exiting...`);
        Deno.exit(0);
    }
    
    await deployRescripts();
}



export async function deployRescripts(){
    // When using emulator, deploy minting policy for s2 tokens first
    const s2PolicyRefUtxo = await (async()=>{
        if (provNetwork == "Custom") {
            return await deployS2MintPolicy();
        } else {
            return s2MintPolicyRefUtxo[provNetwork.toLowerCase()];
        }
    })();

    // The following actions are already combined here:
    // 1. mint beacon tokens for the refscripts
    // 2. deploy compiled refscripts into UTXOs with beacon tokens

    const { initUtxos, newWalletInputs } = await prepInitUtxos();
    const deployUtxo = initUtxos[0];
    const settingsInitUtxo = initUtxos[1];
    lucid.overrideUTxOs(newWalletInputs);

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
    
    const [newWalletInputs2, derivedOutputs, tx] = await lucid
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
        .attachMetadata(674, { msg: ["Havoc Shuffle refscripts deploy"] })
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
    console.log(`Refscripts deploy tx submitted. Hash: ${txHash}`);
    console.log("");

    // Simulate the passage of time and block confirmations
    if (provNetwork == "Custom") {
        emulator.awaitBlock(10);
        console.log("emulated passage of 10 blocks..");
        console.log("");
        lucid.overrideUTxOs(newWalletInputs2);
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
        s2MintPolicy: s2PolicyRefUtxo
    };

    const results = {
        referenceUtxos,
        s2PolicyId,
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
    deployed.s2PolicyId = s2PolicyId;
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
    // Prepare 2 initUtxos from deployer account
    // One will be used for deploying the reference scripts, and the other for initializing the settings.

    const deployerAddr = await lucid.wallet().address();
    const deployerUtxos = await lucid.utxosAt(deployerAddr);
    lucid.overrideUTxOs(deployerUtxos);

    const [newWalletInputs, derivedOutputs, tx] = await lucid
        .newTx()
        .pay.ToAddress(deployerAddr, { lovelace: 100_000_000n })
        .pay.ToAddress(deployerAddr, { lovelace: 100_000_000n })
        .pay.ToAddress(deployerAddr, { lovelace: 50_000_000n })
        .attachMetadata(674, { msg: ["Havoc Shuffle init utxos prep"] })
        .chain();
    const signedTx = await tx.sign.withWallet().complete();
    const txHash = await signedTx.submit();

    // Simulate the passage of time and block confirmations
    if (provNetwork == "Custom") {
        await emulator.awaitBlock(10);
        console.log("emulated passage of 10 blocks..");
        console.log("");
    }

    const initUtxos: UTxO[] = derivedOutputs.filter((utxo) => {
        if (utxo.address == deployerAddr && utxo.assets.lovelace == 100_000_000n) {
            // remove this utxo from newWalletInputs
            let idx = 0;
            for (const input of newWalletInputs){
                if (input.txHash == utxo.txHash && input.outputIndex == utxo.outputIndex){
                    newWalletInputs.splice(idx, 1);
                }
                idx++;
            }

            // add this utxo to the initUtxos list
            return true;
        }
        else return false;
    }) as UTxO[];
    
    console.log("Init UTXOs in deployer account has been prepared. Hash:", txHash);
    console.log("");

    return { initUtxos, newWalletInputs }
}

// Should only be called when using emulator network
export async function deployS2MintPolicy(){
    const assetsToMint = {
        [beaconTokens.hvcS2Policy]: 1n
    };
    const [newWalletInputs, derivedOutputs, tx] = await lucid
        .newTx()
        .mintAssets(assetsToMint, Data.void())
        .pay.ToContract(
            refscriptsScriptAddr,
            { kind: "inline", value: Data.void() },
            { [beaconTokens.hvcS2Policy]: 1n },
            s2MintingScript.custom,
        )        
        .attachMetadata(674, { msg: ["Havoc Shuffle s2 mint policy deploy"] })
        .attach.Script(refscriptsScript)
        .addSignerKey(adminPkh)
        .chain();
    console.log(`deploy s2 mint policy tx built`);
    const signedTx = await tx.sign.withWallet().complete();
    const txJson = JSON.parse(stringify(signedTx));
    console.log(`txFee: ${parseInt(txJson.body.fee) / 1_000_000} ADA`);
    console.log("");

    const txHash = await signedTx.submit();
    console.log(`Refscripts deploy tx submitted. Hash: ${txHash}`);
    console.log("");

    // Simulate the passage of time and block confirmations
    emulator.awaitBlock(10);
    console.log("emulated passage of 10 blocks..");
    console.log("");

    // update lucid instance UTXOs
    lucid.overrideUTxOs(newWalletInputs);

    const s2PolicyRefUtxo: UTxO = derivedOutputs.find((utxo) => {
        if (utxo.assets[beaconTokens.hvcS2Policy]) return true;
        else return false;
    }) as UTxO;


    return s2PolicyRefUtxo;
}