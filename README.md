# havoc-shuffle

Cardano on-chain components for [Havoc Worlds](https://havocworlds.io)' shuffle system. An upgradeable protocol written in
Aiken.

## What this does

- **Live Shuffle** (while S2 is still minting)

  Users can submit (lock into the main contract) an S2 NFT, together with some small amount of $ADA and some pre-determined
  amount of $VOQ tokens. In exchange, they will get a new, random S2 NFT minted and sent back to them.

  The NFTs submitted by users are kept in the contract, to be used later in the `reshuffle` program which starts after all the
  S2 NFTs are minted. The ADA that is left over from the minting and tx fees, is likewise kept in the contract, to be later used
  by the project for other purposes.

- **Reshuffle** (after all S2 NFTs are minted)

  Users can likewise submit an S2 NFT, together with some pre-deterrmined $ADA + $VOQ amounts and in exchange, they will get
  another randomly selected S2 NFT from the pool of NFTs previously submitted during the `live shuffle` phase.

## Building Plutus contracts

```sh
aiken build --out plutus-mainnet.json

# or:
aiken build -t verbose --out plutus-preprod.json
```

## Testing Aiken contracts

To run all tests:

```sh
aiken check
```

To run only tests matching the string `foo`, do:

```sh
aiken check -m foo
```

## How this works

The protocol is mainly composed of 3 validators: `vault.ak`, `settings.ak`, and `protocol.ak`. There is also the `refscripts.ak`
that is used only to hold the UTXOs containing the compiled UPLC code of the validators, as `reference_scripts`.

- `settings`

  This is the minting policy for the _beacon token_ that marks the UTXO with the datum containing the settings for the protocol
  -- mainly the latest hash of the upgradeable `protocol` validator.

  This is also the validator that holds this `settings` _beacon token_.

  Its only parameter is the admin's verification key hash.

  The `settings` **datum** contains the following items:

  1. The `vault` script hash
  1. The `protocol` script hash
  1. The S2 policy ID (`s2_policy_id`)
  1. Max number of NFTs to shuffle per tx (`max_to_shuffle`)

  Its _minting_ validation allows minting/burning of the beacon token only if:

  1. ✅ Signed by the admin, as provided in the script's parameter.

  Its _spending_ validation evaluates to `True` only in the following `Redeemer` cases:

  1. Redeemer `ReadSettings`:
     - ✅ if one of the inputs consumed is from the `vault`
     - ✅ if the _beacon token_ is returned to the same address, with unchanged datum

  1. Redeemer `UpdateSettings`:
     - ✅ if the tx is signed by the admin

- `vault`

  This validator holds the assets submitted by users.

  It is parameterized with the script hash of the `settings` validator, and the `asset_name` of the _beacon token_.

  It only allows spending of its held UTXOs if:

  1. ✅ One of the _inputs_ contains the `settings` _beacon token_.
  1. ✅ From the `settings` UTXO datum, the latest `protocol` script hash is determined. An input from that script is then also
     required, triggering the evaluation of the `protocol`'s validation logic.

  UTXOs representing requests from users, contain in their datum the address of the requesting user (owner of the submitted NFTs
  to be replaced).

  UTXOs representing requests that have already been fulfilled, contain empty datums.

- `protocol`

  This contains the main validator business logic which can be updated/upgraded.

  It is parameterized with:

  1. The script hash of the `settings` validator
  1. The `asset_name` of the _beacon token_
  1. The admin's verification key hash

  The current version allows spending UTXOs from the `vault` only if the following conditions are satisfied, depending on the
  `Redeemer`:

  - Redeemer `LiveShuffle`:

    1. ✅ One of the inputs should be the `settings` UTXO (expected, since also required by `vault`).
    1. ✅ The own input of the `protocol` validator is retained at the `protocol` address.
    1. ✅ There must be 1 and only 1 input from the `vault`.
    1. ✅ The _vault input_ must contain in its datum the requesting user's address.
    1. ✅ There must be at least 1 S2 NFT in the _vault input_, and a total not exceeding the `max_to_shuffle` setting.
    1. ✅ There must be the same quantity of input S2 NFTs being minted.
    1. ✅ There must be 1 and only 1 output to the user.
    1. ✅ The newly minted S2 NFTs must be sent to the requesting user's address.
    1. ✅ There must be 1 and only 1 output to the `vault`.
    1. ✅ There must be no other output other than those going to the `settings`, `vault`, `protocol`, and user addresses.
    1. ✅ The input S2 NFTs, and the leftover lovelaces must be sent back to the `vault`, but this time containing an empty
       datum.

  - Redeemer `ReShuffle`:

    1. ✅ One of the inputs should be the `settings` UTXO (expected, since also required by `vault`).
    1. ✅ The own input of the `protocol` validator is retained at the `protocol` address.
    1. ✅ There should be no tokens minted in the tx.
    1. ✅ There must be 1 and only 1 input from the _vault_ that contain in its datum the requesting user's address. This is the
       `request_input`.
    1. ✅ There must be at least 1 other input from the _vault_ that contains empty datum (`pool_inputs`).
    1. ✅ However many S2 NFTs are in the `request_input`, the same should be taken from the `pool_inputs` and sent to the
       requesting user.
    1. ✅ The S2 NFTs from the `request_input`, and the leftover lovelaces and NFTs from the `pool_inputs`, must be sent back to
       the `vault`, this time containing an empty datum.

  - Redeemer `CancelShuffle`:

    1. ✅ One of the inputs should be the `settings` UTXO (expected, since also required by `vault`).
    1. ✅ The own input of the `protocol` validator is retained at the `protocol` address.
    1. ✅ There must be 1 and only 1 input from the `vault`.
    1. ✅ The _vault input_ must contain in its datum the requesting user's address.
    1. ✅ The assets in the _vault input_ must all be sent back to the requesting user's address.
    1. ✅ The transaction must be signed either by the requesting user, or by the admin.

  - Redeemer `Administer`:

    1. ✅ The transaction must be signed by the admin. This is useful only when the `protocol` validator is upgraded/retired.


## Usage / Testing

1. **Deploy as `reference_scripts`**:

    ```shell
    deno task deploy-preprod
    # or
    deno task deploy-mainnet
    ```

    This will update/write results into file `data/deployed-{preprod | mainnet}.json`

1. **Un-deploy**:

    Done only when updating reference scripts, or decommissioning.

    ```shell
    deno task undeploy-preprod
    # or
    deno task undeploy-mainnet
    ```

1. **Initilize `settings` and `protocol` UTXOs**
1. **Mint some test S2 NFTs**
1. **Make a `LiveShuffle` request**
1. **Fulfill a `LiveShuffle` request**
1. **Make a `ReShuffle` request**
1. **Fulfill a `ReShuffle` request**
1. **Cancel a `LiveShuffle` or `ReShuffle` request**
1. **Update settings datum**



## Todo:

1. ✅ Update `protocol` logic for `LiveShuffle`. Take into consideration that when minting, CIP68 ref tokens are also minted, not just user tokens.