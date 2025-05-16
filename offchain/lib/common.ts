import {
    Credential,
    credentialToRewardAddress,
    Data,
    getAddressDetails,
    Kupmios,
    Lucid,
    Network,
} from "@lucid-evolution/lucid";

export const provNetwork = (Deno.args[0] || "Preprod") as Network;
const kupoUrl = provNetwork == "Mainnet"
    ? Deno.env.get("DEMETER_MAINNET_KUPO") as string
    : Deno.env.get("DEMETER_PREPROD_KUPO") as string;
const ogmiosUrl = provNetwork == "Mainnet"
    ? Deno.env.get("DEMETER_MAINNET_OGMIOS") as string
    : Deno.env.get("DEMETER_PREPROD_OGMIOS") as string;
export const providerKupmios = new Kupmios(kupoUrl, ogmiosUrl);

const lucid = await Lucid(providerKupmios, provNetwork);
const WALLET_SEED = Deno.env.get("WALLET_SEED") as string;

lucid.selectWallet.fromSeed(WALLET_SEED);

export function getLucidInstance() {
    return lucid;
}

export const adminAddress = await lucid.wallet().address();
export const adminStakeCred = getAddressDetails(adminAddress).stakeCredential as Credential;
export const adminPaymtCred = getAddressDetails(adminAddress).paymentCredential as Credential;
export const adminStakeAddr = credentialToRewardAddress(provNetwork, adminStakeCred);
export const adminPkh = adminStakeCred.hash; // staking PKH
export const adminSpendPkh = adminPaymtCred.hash; // payment PKH

export const blueprint = JSON.parse(
    new TextDecoder().decode(Deno.readFileSync(`./plutus-${provNetwork.toLowerCase()}.json`)),
);

export enum CredentialType {
    script = "Script",
    key = "Key",
}

export type AssetClass = {
    policy_id: string;
    asset_name: string;
};

// ```aiken
// pub type UnifiedRedeemer {
//   MintBeaconToken
//   BurnBeaconToken
//   ReadSettings
//   UpdateSettings
//   LiveShuffle
//   ReShuffle
//   CancelShuffle
//   Administer
// }
// ```
export enum RedeemerType {
    MintBeaconToken = "MintBeaconToken",
    BurnBeaconToken = "BurnBeaconToken",
    ReadSettings = "ReadSettings",
    UpdateSettings = "UpdateSettings",
    LiveShuffle = "LiveShuffle",
    ReShuffle = "ReShuffle",
    CancelShuffle = "CancelShuffle",
    Administer = "Administer",
}
const UnifiedRedeemerSchema = Data.Enum([
    Data.Literal(RedeemerType.MintBeaconToken),
    Data.Literal(RedeemerType.BurnBeaconToken),
    Data.Literal(RedeemerType.ReadSettings),
    Data.Literal(RedeemerType.UpdateSettings),
    Data.Literal(RedeemerType.LiveShuffle),
    Data.Literal(RedeemerType.ReShuffle),
    Data.Literal(RedeemerType.CancelShuffle),
    Data.Literal(RedeemerType.Administer),
]);
export type UnifiedRedeemer = Data.Static<typeof UnifiedRedeemerSchema>;
export const UnifiedRedeemer = UnifiedRedeemerSchema as unknown as UnifiedRedeemer;

// Address schema
export type PlutusVerificationKey = { VerificationKey: [string] };
export type PlutusScriptKey = { Script: [string] };
export type PlutusPaymentCred = PlutusVerificationKey | PlutusScriptKey;
export type PlutusStakeCred = { Inline: [PlutusVerificationKey | PlutusScriptKey] } | {
    Pointer: { slot_number: bigint; transaction_index: bigint; certificate_index: bigint };
} | null;
export type AddressObj = {
    payment_credential: PlutusPaymentCred;
    stake_credential: PlutusStakeCred;
};
export const AddressSchema = Data.Object({
    payment_credential: Data.Enum([
        Data.Object({ VerificationKey: Data.Tuple([Data.Bytes()]) }),
        Data.Object({ Script: Data.Tuple([Data.Bytes()]) }),
    ]),
    stake_credential: Data.Nullable(
        Data.Enum([
            Data.Object({
                Inline: Data.Tuple([
                    Data.Enum([
                        Data.Object({ VerificationKey: Data.Tuple([Data.Bytes()]) }),
                        Data.Object({ Script: Data.Tuple([Data.Bytes()]) }),
                    ]),
                ]),
            }),
            Data.Object({
                Pointer: Data.Object({
                    slot_number: Data.Integer(),
                    transaction_index: Data.Integer(),
                    certificate_index: Data.Integer(),
                }),
            }),
        ]),
    ),
});

export const deployDetailsFile = `./data/deployed-${provNetwork.toLowerCase()}.json`;

try {
    await Deno.lstat("./data");
    // do nothing if dir already exists
} catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
        throw err;
    }
    Deno.mkdirSync("./data");
}

// details of deployed refscripts/utxos
export const deployed = await (async () => {
    try {
        await Deno.lstat(deployDetailsFile);
        const deployed = JSON.parse(new TextDecoder().decode(Deno.readFileSync(deployDetailsFile)));
        return deployed;
    } catch (err) {
        if (!(err instanceof Deno.errors.NotFound)) {
            throw err;
        }
        return undefined;
    }
})();
