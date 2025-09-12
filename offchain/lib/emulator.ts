import {
    Lucid,
    Assets,
    Emulator,
    walletFromSeed,
    ProtocolParameters,
} from "@lucid-evolution/lucid";

import { 
    testS2NFTs,
    USER_WALLET_SEED,
    ADMIN_WALLET_SEED,
} from "./common.ts";

// Generates an account to be used by the Emulator
// similar to Lucid's generateEmulatorAccount, but allows specifying a seed phrase
export function generateEmulatorAccountWithSeed(seed: string, assets?: Assets) {
    return {
        seedPhrase: seed,
        address: walletFromSeed(seed, {
            addressType: "Base",
            accountIndex: 0,
            network: "Custom",
            }).address,
        assets: assets ?? {},
        privateKey: "",
    };
}


export const emuAdminAcct = generateEmulatorAccountWithSeed(ADMIN_WALLET_SEED, {
  lovelace: 10_000_000_000n, // 10,000 ADA
});
export const emuUserAcct = generateEmulatorAccountWithSeed(USER_WALLET_SEED, {
  lovelace: 10_000_000_000n,
  [testS2NFTs["HW S2 0999"]]: 1n,
  [testS2NFTs["HW S2 1000"]]: 1n
});

export const emulator = new Emulator([emuAdminAcct, emuUserAcct]);
const lucidInit = await Lucid(emulator, "Custom");
const protocolParams = lucidInit.config().protocolParameters as ProtocolParameters;
protocolParams.maxTxSize = protocolParams.maxTxSize * 10;
const emuLucid = await Lucid(emulator, "Custom", {presetProtocolParameters: protocolParams});

// initial/default account for Emulator Lucid instance
emuLucid.selectWallet.fromSeed(emuAdminAcct.seedPhrase);

export function getEmulatorInstance() {
    return emuLucid;
}