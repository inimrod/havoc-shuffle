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
    UTxO,
    Script,
    Network,
    // scriptFromNative,
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

const lucid = provNetwork == "Custom" 
    ? await Lucid(providerKupmios, provNetwork) 
    : await Lucid(providerBlockfrost, provNetwork);

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
            protocol_idx: Data.Integer(),
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
        return {}; // return empty object if file doesn't exist
    }
})();

export const s2MintingScript: Record<string, Script> = {
    custom: {
        type: "PlutusV2",
        script: "59017a01000032323232323232323232323232323232323232323232323232323232323232225333573466006900018100008a4c2603e9211976616c69646174696f6e2072657475726e65642066616c736500223301d13301b003480004cc060cc024c01c0040112401117369676e65642062792061646d696e3a200048008c0053011e581c611f527762bdcb19a2156a0039fac9e6ee2253481aebb214bb9433250000175c00246ae84c03400488c8cc03cc01000c8cdd7800801180780091bac3002001235742600400246ae88c0080048d5d1180100091aba23002001235744600400246ae88c0080048d5d1180100091aba23002001235744600400246aae78dd500091191998008008018011112999aab9f00214a02a666ae68c004d5d08010a51133300300335744004002002ea488cd5ce19802000a980180100110999ab9a00149104747275650049010566616c73650072c44600666e240080048ccd5cd000a504a244a666ae694008540045281299ab9c00116001200101",        
    },
    preprod: {
        type: "PlutusV2",
        script: "59017a01000032323232323232323232323232323232323232323232323232323232323232225333573466006900018100008a4c2603e9211976616c69646174696f6e2072657475726e65642066616c736500223301d13301b003480004cc060cc024c01c0040112401117369676e65642062792061646d696e3a200048008c0053011e581c611f527762bdcb19a2156a0039fac9e6ee2253481aebb214bb9433250000175c00246ae84c03400488c8cc03cc01000c8cdd7800801180780091bac3002001235742600400246ae88c0080048d5d1180100091aba23002001235744600400246ae88c0080048d5d1180100091aba23002001235744600400246aae78dd500091191998008008018011112999aab9f00214a02a666ae68c004d5d08010a51133300300335744004002002ea488cd5ce19802000a980180100110999ab9a00149104747275650049010566616c73650072c44600666e240080048ccd5cd000a504a244a666ae694008540045281299ab9c00116001200101",        
    },
    mainnet: {
        "type": "PlutusV2",
        "script": "5882010000225333573466446464666002002004466ebc004dd48021112999aab9f00214a02a666ae68c004d5d08010a511333003003357440040026eb0d5d09aba2357446ae88d5d11aba2357446ae88d5d11aab9e37540046ae84d55cf1baa0014891c611f527762bdcb19a2156a0039fac9e6ee2253481aebb214bb94332500149859"
    }
};
export const s2PolicyId = mintingPolicyToId(s2MintingScript[provNetwork.toLowerCase()]);

export const s2MintPolicyRefUtxo: Record<string, UTxO> = {
    preprod: {
        "txHash": "b1929747259cc5fbfa47186cd53e887686540e70c7292398395af413c9f63ca6",
        "outputIndex": 0,
        "assets": {
            "lovelace": 2904940n,
            "1170080521cf4fcd88d6205041cf55f72f70820e27ad444d61c6d7f96876635332506f6c696379": 1n
        },
        "address": "addr_test1zqqqapmt5rdujg8yj6thdpe3hw52396kws3e47g5m5g84ey3te374kl92m5f3cf30k76974jm2x8rrw5pgu0e2fwukusxvp3e9",
        "datum": "d87980",
        "scriptRef": s2MintingScript.preprod,
    },
    mainnet: {
        "txHash": "feae18fe8b6149fb33442b727b23c246efa30807b4797698c5e48740168ff2a8",
        "outputIndex": 0,
        "assets": {
            "lovelace": 1823130n,
            "18f0e6a5e0846d2d7ca106d06bd8a7ac9af41b67162907ee5c8368426876635332506f6c696379": 1n
        },
        "address": "addr1zxxauswy8ce9ny497etw0l86e5vz582hdlphrxa5rpk633v3te374kl92m5f3cf30k76974jm2x8rrw5pgu0e2fwukusxjs4zx",
        "datum": "d87980",
        "scriptRef": s2MintingScript.mainnet,
    }    
};

export const prefix_100 = "000643b0";
export const prefix_222 = "000de140";

export const testS2NFTs = [
    `${s2PolicyId}${prefix_222}${fromText("HW S2 3123")}`,
    `${s2PolicyId}${prefix_222}${fromText("HW S2 0208")}`,
    `${s2PolicyId}${prefix_222}${fromText("HW S2 0120")}`,
]

export const testLiveShuffleNFTs = [
    {
        "ref": `${s2PolicyId}${prefix_100}${fromText("HW S2 1072")}`,
        "usr": `${s2PolicyId}${prefix_222}${fromText("HW S2 1072")}`
    },
    {
        "ref": `${s2PolicyId}${prefix_100}${fromText("HW S2 1073")}`,
        "usr": `${s2PolicyId}${prefix_222}${fromText("HW S2 1073")}`,
    },
    {
        "ref": `${s2PolicyId}${prefix_100}${fromText("HW S2 1074")}`,
        "usr": `${s2PolicyId}${prefix_222}${fromText("HW S2 1074")}`,
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