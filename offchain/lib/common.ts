import {
    Credential,
    credentialToRewardAddress,
    Data,
    fromText,
    getAddressDetails,
    Kupmios,
    Blockfrost,
    Lucid,
    mintingPolicyToId,
    Network,
    scriptFromNative,
    // unixTimeToSlot,
} from "@lucid-evolution/lucid";

export const provNetwork = (Deno.args[0] || "Custom") as Network;
const kupoUrl = provNetwork == "Mainnet"
    ? Deno.env.get("DEMETER_MAINNET_KUPO") as string
    : Deno.env.get("DEMETER_PREPROD_KUPO") as string;
const ogmiosUrl = provNetwork == "Mainnet"
    ? Deno.env.get("DEMETER_MAINNET_OGMIOS") as string
    : Deno.env.get("DEMETER_PREPROD_OGMIOS") as string;
export const providerKupmios = new Kupmios(kupoUrl, ogmiosUrl);


export const bfrostUrl = provNetwork == "Preprod"
    ? "https://cardano-preprod.blockfrost.io/api/v0"
    : "https://cardano-mainnet.blockfrost.io/api/v0";
export const bfrostKey = provNetwork == "Preprod"
    ? Deno.env.get("BFROST_PREPROD") as string
    : Deno.env.get("BFROST_MAINNET") as string;    
export const providerBlockfrost = new Blockfrost(bfrostUrl, bfrostKey);

const lucid = await Lucid(providerKupmios, provNetwork);
export const ADMIN_WALLET_SEED = Deno.env.get("ADMIN_WALLET_SEED") as string;
export const USER_WALLET_SEED = Deno.env.get("USER_WALLET_SEED") as string;

lucid.selectWallet.fromSeed(ADMIN_WALLET_SEED);

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

export const AssetClassSchema = Data.Object({
    policy_id: Data.Bytes({ minLength: 0, maxLength: 28 }),
    asset_name: Data.Bytes({ minLength: 0, maxLength: 64 }),
});

export type AssetClass = Data.Static<typeof AssetClassSchema>;


export enum RedeemerEnum {
    MintSettingsBeacon = "MintSettingsBeacon",
    BurnSettingsBeacon = "BurnSettingsBeacon",
    UpdateSettings = "UpdateSettings",
    LiveShuffle = "LiveShuffle",
    ReShuffle = "ReShuffle",
    CancelShuffle = "CancelShuffle",
    Administer = "Administer",
    SpendBadUtxo = "SpendBadUtxo",
    RetireProtocol = "RetireProtocol"
}
const UnifiedRedeemerSchema = Data.Enum([
    Data.Object({
        [RedeemerEnum.MintSettingsBeacon]: Data.Object({
            init_utxo_idx: Data.Integer()
        }),
    }),

    Data.Object({
        [RedeemerEnum.BurnSettingsBeacon]: Data.Object({
            gcfg_utxo_idx: Data.Integer()
        }),
    }),

    Data.Object({
        [RedeemerEnum.UpdateSettings]: Data.Object({
            input_idx: Data.Integer(),
            output_idx: Data.Integer(),
        }),
    }),

    Data.Object({
        [RedeemerEnum.LiveShuffle]: Data.Object({
            protocol_idxs: Data.Tuple([Data.Integer(), Data.Integer()]),
            vault_idxs: Data.Tuple([Data.Integer(), Data.Integer()]),
            user_idx: Data.Integer(),
            ref_idxs: Data.Array(Data.Integer()),
            settings_idx: Data.Integer(),
        }),
    }),

    Data.Object({
        [RedeemerEnum.ReShuffle]: Data.Object({
            protocol_idxs: Data.Tuple([Data.Integer(), Data.Integer()]),
            settings_idx: Data.Integer(),
            request_idx: Data.Integer(),
            pool_idxs: Data.Array(Data.Integer()),
            pool_oidx: Data.Integer(),
            user_idx: Data.Integer(),
        }),
    }),

    Data.Object({
        [RedeemerEnum.CancelShuffle]: Data.Object({
            protocol_idxs: Data.Tuple([Data.Integer(), Data.Integer()]),
            settings_idx: Data.Integer(),
            request_idx: Data.Integer(),
            user_idx: Data.Integer(),
        }),
    }),

    Data.Object({
        [RedeemerEnum.Administer]: Data.Object({
            protocol_idxs: Data.Tuple([Data.Integer(), Data.Integer()]),
            settings_idx: Data.Integer(),
        }),
    }),

    Data.Object({
        [RedeemerEnum.SpendBadUtxo]: Data.Object({
            protocol_idxs: Data.Tuple([Data.Integer(), Data.Integer()]),
            bad_utxo_idx: Data.Integer(),
            settings_idx: Data.Integer(),
        }),
    }),

    Data.Object({
        [RedeemerEnum.RetireProtocol]: Data.Object({
            protocol_idxs: Data.Integer(),
            settings_idx: Data.Integer(),
        }),
    })
]);
export type UnifiedRedeemerType = Data.Static<typeof UnifiedRedeemerSchema>;
export const UnifiedRedeemer = UnifiedRedeemerSchema as unknown as UnifiedRedeemerType;


// Address type / schema
export type PlutusVerificationKey = { VerificationKey: [string] };
export type PlutusScriptKey = { Script: [string] };
export type PlutusPaymentCred = PlutusVerificationKey | PlutusScriptKey;
export type PlutusStakeCred = { Inline: [PlutusVerificationKey | PlutusScriptKey] } | {
    Pointer: { slot_number: bigint; transaction_index: bigint; certificate_index: bigint };
} | null;

export const CredSchema = Data.Enum([
    Data.Object({ VerificationKey: Data.Tuple([Data.Bytes()]) }),
    Data.Object({ Script: Data.Tuple([Data.Bytes()]) }),
]);
export const StakeCredSchema = Data.Nullable(
    Data.Enum([
        Data.Object({
            Inline: Data.Tuple([CredSchema]),
        }),
        Data.Object({
            Pointer: Data.Object({
                slot_number: Data.Integer(),
                transaction_index: Data.Integer(),
                certificate_index: Data.Integer(),
            }),
        }),
    ]),
);
export const AddressSchema = Data.Object({
    payment_credential: CredSchema,
    stake_credential: StakeCredSchema,
});
export type AddressType = Data.Static<typeof AddressSchema>;


export const deployDetailsFile = `./data/deployed-${provNetwork.toLowerCase()}.json`;

// create ./data dir if it doesn't exist
try {
    await Deno.lstat("./data"); // do nothing if dir already exists
    
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

// For preprod testing:
export const demoS2MintingScript = scriptFromNative({
    type: "all",
    scripts: [
        { type: "sig", keyHash: adminPkh },
        // { type: "after", slot: unixTimeToSlot(lucid.config().network as Network, 0) },
    ],
});
export const demoS2PolicyId = mintingPolicyToId(demoS2MintingScript);

export const s2PolicyId = provNetwork == "Mainnet" 
    ? Deno.env.get("S2_POLICY_ID_MAINNET") as string 
    : demoS2PolicyId;

export const prefix_100 = "000643b0";
export const prefix_222 = "000de140";

export const testS2NFTs = [
    `${s2PolicyId}${prefix_222}${fromText("HW S2 0999")}`,
    `${s2PolicyId}${prefix_222}${fromText("HW S2 1000")}`,
]

export const testLiveShuffleNFTs = [
    {
        "ref": `${s2PolicyId}${prefix_100}${fromText("HW S2 1069")}`,
        "usr": `${s2PolicyId}${prefix_222}${fromText("HW S2 1069")}`
    },
    {
        "ref": `${s2PolicyId}${prefix_100}${fromText("HW S2 0069")}`,
        "usr": `${s2PolicyId}${prefix_222}${fromText("HW S2 0069")}`,
    }
];

export const refTokensValidatorHash = provNetwork == "Mainnet" 
    ? Deno.env.get("HVC_S2_REFTOKENS_VAL_HASH_MAINNET") as string 
    : Deno.env.get("HVC_S2_REFTOKENS_VAL_HASH_PREPROD") as string;

export const refTokensValidatorAddr = provNetwork == "Mainnet" 
    ? Deno.env.get("HVC_S2_REFTOKENS_VAL_ADDR_MAINNET") as string 
    : Deno.env.get("HVC_S2_REFTOKENS_VAL_ADDR_PREPROD") as string;


// validator params used by vault and protocol scripts
export const ProtocolValParamsSchema = Data.Object({
    cfg_policy: Data.Bytes({ minLength: 0, maxLength: 28 })
});
export type ProtocolValParamsType = Data.Static<typeof ProtocolValParamsSchema>;
export const ProtocolValParams = ProtocolValParamsSchema as unknown as ProtocolValParamsType;

// OutputReference schema
export const OutputRefSchema = Data.Object({
    transaction_id: Data.Bytes({ minLength: 32, maxLength: 32 }),
    output_index: Data.Integer(),
});
export type OutputReferenceType = Data.Static<typeof OutputRefSchema>;
export const OutputReference = OutputRefSchema as unknown as OutputReferenceType;