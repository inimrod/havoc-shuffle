import {
    Lucid,
    Emulator,
    generateEmulatorAccount
} from "@lucid-evolution/lucid";


export const emuAdminAcct = generateEmulatorAccount({
  lovelace: 10_000_000_000n, // 10,000 ADA
});
export const emuUserAcct = generateEmulatorAccount({
  lovelace: 10_000_000_000n, // 10,000 ADA
});

export const emulator = new Emulator([emuAdminAcct, emuUserAcct]);
const emuLucid = await Lucid(emulator, "Custom");

// initial/default account for Emulator Lucid instance
emuLucid.selectWallet.fromSeed(emuAdminAcct.seedPhrase);

export function getEmulatorInstance() {
    return emuLucid;
}