import { UTxO } from "@lucid-evolution/lucid";
import { beaconTokens } from "./refscripts.ts";

const wantedRefUtxoTokens = [
    beaconTokens.refscripts,
    beaconTokens.settings,
    beaconTokens.vault,
    beaconTokens.protocol,
];

/**
 * Find utxos that can be used in transaction to deploy validators as reference scripts. The utxos should contain the beacon tokens
 * needed to go along with each reference script. Additional utxos will also be selected until there is a total of at least
 * 100_000_000 lovelace in the selected utxos.
 *
 * @param utxos - The list of utxos to select from
 * @param reserved - An optional utxo that should not be included in the result
 * @returns A tuple of the selected utxos and a mapping from the indices of the selected utxos in the input array to the utxos themselves.
 */
export function getDeployUtxos(utxos: UTxO[], reserved?: UTxO): [UTxO[], Record<number, UTxO>] {
    const reservedId = reserved ? reserved.txHash + reserved.outputIndex : undefined;
    const foundRefUtxoTokens: Record<number, UTxO> = {};

    let adaInFoundRefUtxos = 0n;
    wantedRefUtxoTokens.forEach((token) => {
        for (const [idx, utxo] of (Object.entries(utxos) as unknown as [number, UTxO][])) {
            if (utxo.assets[token] && !foundRefUtxoTokens[idx]) {
                foundRefUtxoTokens[idx] = utxo;
                adaInFoundRefUtxos += utxo.assets["lovelace"];
            }
        }
    });
    const deployUtxos = Object.entries(foundRefUtxoTokens).map(([, utxo]) => utxo);

    if (adaInFoundRefUtxos < 100_000_000n) {
        Object.entries(utxos).forEach(([idx, utxo]) => {
            const utxoId = utxo.txHash + utxo.outputIndex;
            if (adaInFoundRefUtxos < 100_000_000n && !foundRefUtxoTokens[Number(idx)]) {
                if (utxoId !== reservedId) {
                    adaInFoundRefUtxos += utxo.assets["lovelace"];
                    foundRefUtxoTokens[Number(idx)] = utxo;
                    deployUtxos.push(utxo);
                }
            }
        });
    }

    return [deployUtxos, foundRefUtxoTokens];
}
