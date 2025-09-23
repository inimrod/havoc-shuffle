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

The protocol is mainly composed of 3 validators: `settings.ak`, `vault.ak`, and `protocol.ak`. There is also the `refscripts.ak` that is used only to hold the UTXOs containing the compiled UPLC code of the validators, as `reference_scripts`.

- `settings.ak`

  This is the minting policy for the _beacon token_ that marks the UTXO with the datum containing the settings for the protocol -- most importantly the latest hash of the upgradeable `protocol` validator.

  This is also the validator that holds this `settings` _beacon token_.

  It is parameterized with the `OutputReference` of the _initial utxo_ used in minting the settings beacon token.

  The `settings` **datum** contains the following items:

  1. the `admin` verification key hash
  1. the `refscripts` script hash
  1. the `reftokens` script hash
  1. The `vault` script hash
  1. The `protocol` script hash
  1. The S2 policy ID (`s2_policy_id`)
  1. Max number of NFTs to shuffle per tx (`max_to_shuffle`)

  Its `mint` validation purpose evaluates to True only in the following cases:

  1. Redeemer `MintSettingsBeacon`:
    1. ✅ The initial utxo provided in the script's parameter is among the tx inputs.
    1. ✅ The settings beacon token (`global_cfg_token`) is minted in the tx.

  1. Redeemer `BurnSettingsBeacon`:
    1. ✅ The settings beacon token (`global_cfg_token`) is burned in the tx.
    1. ✅ The tx is signed by the admin, as set in the global settings datum

  Its _spend_ validation purpose evaluates to `True` only in the following `Redeemer` cases:

  1. Redeemer `UpdateSettings`:
     - ✅ if one of the inputs consumed is the utxo containing the `global_cfg_token` (_config utxo_)
     - ✅ if the _config utxo_ is returned back to the `settings` contract.
     - ✅ if the tx is signed by the admin

  1. Redeemer `BurnSettingsBeacon`:
     - ✅ if one of the inputs consumed is the utxo containing the `global_cfg_token` (_config utxo_)
     - ✅ The settings beacon token (`global_cfg_token`) is burned in the tx.

  1. Redeemer `SpendBadUtxo`:
     - ✅ if the input utxo from the settings contract does not contain the settings beacon token (`global_cfg_token`)
     - ✅ if the tx is signed by the admin

- `vault.ak`

  This validator holds the assets submitted by users, both the ones that are for exchanging and those that have been exchanged already.

  It is parameterized with the script hash of the `settings` validator (`cfg_policy`).

  It only allows spending of its held UTXOs if:
  
  1. ✅ The redeemer is one of the following: `LiveShuffle`, `ReShuffle`, `CancelShuffle`, `Administer` and `SpendBadUtxo`.
  1. ✅ One of the _reference inputs_ is the _config utxo_.
  1. ✅ One of the _inputs_ consumed is a utxo held by the `protocol` contract. This triggers the evaluation of the `protocol`'s validation logic.

  Shuffle request UTXOs from users, contain in their datum the address of the requesting user (owner of the submitted NFTs to be replaced). 

  UTXOs representing requests that have already been fulfilled, contain empty datums.

- `protocol.ak`

  This contains the main validator business logic which can be updated/upgraded.

  It is likewise parameterized with the script hash of the `settings` validator (`cfg_policy`).
  
  The current version allows spending UTXOs from the `vault` only if the following conditions are satisfied, depending on the `Redeemer`:

  - Redeemer `LiveShuffle`:

    1. ✅ The utxo from the `protocol` contract that is consumed in the tx, is returned with no changes.
    1. ✅ The _config utxo_ should be among the reference inputs (expected, since also required by `vault`).
    1. ✅ The _vault input_ (_request utxo_) specified in the redeemer must be:
       1. ✅ confirmed to be held by the `vault` contract as checked against the _config utxo_ datum
       1. ✅ contain in its datum the requesting user's address.
    1. ✅ There must be 1 and only 1 input from the `vault`.
    1. The tokens contained in the _request utxo_ must be sent back to the `vault` contract, but without a datum anymore.    
    1. ✅ There must be at least 1 S2 NFT in the _vault input_, and a total not exceeding the `max_to_shuffle` setting.
    1. ✅ There must be the same quantity of input S2 NFTs being minted.
    1. ✅ The newly minted S2 NFTs (CIP68 user tokens) must be sent to the requesting user's address.
    1. ✅ The CIP68 reference tokens that are also minted, are sent to the `reftokens` address specified in the global settings.    
    1. ✅ There must be no inputs other than: 1 from the `vault` contract (_request utxo_), and 1 from the `protocol` contract. (total of only 2)
    1. ✅ There must be no outputs other from those going to the `vault` contract, `protocol` contract, `reftokens` contract, and the requesting user addresses. (total of only 4)
    

  - Redeemer `ReShuffle`:

    1. ✅ The utxo from the `protocol` contract that is consumed in the tx, is returned with no changes.
    1. ✅ The _config utxo_ should be among the reference inputs (expected, since also required by `vault`).
    1. ✅ There should be no tokens minted in the tx.
    1. ✅ The _request utxo_ specified in the redeemer must be:
       1. ✅ confirmed to be held by the `vault` contract as checked against the _config utxo_ datum
       1. ✅ contain in its datum the requesting user's address.
    1. ✅ There must be at least 1 other input from the _vault_ that contains empty datum (`pool_inputs`).
    1. ✅ However many S2 NFTs are in the `request_input`, the same should be taken from the `pool_inputs` and sent to the requesting user.
    1. ✅ The S2 NFTs from the `request_input`, and the leftover lovelaces and NFTs from the `pool_inputs`, must be sent back to the `vault`, this time containing an empty datum.
    1. ✅ The total number of actual input utxos from the `vault` contract should match the sum of the `request_input` and the `pool_inputs` count. This prevents spending any other vault utxo that is not needed in the tx.

  - Redeemer `CancelShuffle`:

    1. ✅ The utxo from the `protocol` contract that is consumed in the tx, is returned with no changes.
    1. ✅ The _config utxo_ should be among the reference inputs (expected, since also required by `vault`).
    1. ✅ There must be 1 and only 1 input from the `vault` (_request utxo_).
    1. ✅ The _request utxo_ specified in the redeemer must be:
       1. ✅ confirmed to be held by the `vault` contract as checked against the _config utxo_ datum
       1. ✅ contain in its datum the requesting user's address.    
    1. ✅ The assets in the _request utxo_ must all be included the _user output_ sepcified in the redeemer.
    1. ✅ The transaction must be signed either by the requesting user, or by the admin.

  - Redeemer `Administer`: This is used for handling assets in the vault contract for administrative purposes like combining or splitting utxos, appropriating funds, and similar purposes.
  
    1. ✅ The utxo from the `protocol` contract that is consumed in the tx, is returned with no changes.
    1. ✅ The _config utxo_ should be among the reference inputs (expected, since also required by `vault`).
    1. ✅ All the input utxos from the `vault` contract must *not* contain a valid `VaultDatum` (meaning they are all owned by the pool only)
    1. ✅ The transaction must be signed by the protocol admin.

  - Redeemer `SpendBadUtxo`: This is used for consuming spam utxos or any utxos with malformed datum at the `vault` contract.

    1. ✅ The utxo from the `protocol` contract that is consumed in the tx, is returned with no changes.
    1. ✅ The _config utxo_ should be among the reference inputs (expected, since also required by `vault`).
    1. ✅ All the input utxos from the `vault` contract must either have no S2 tokens or have an invalid datum
    1. ✅ The transaction must be signed by the protocol admin.


  - Redeemer `RetireProtocol`: This is useful only when the `protocol` validator is upgraded/retired.

    1. ✅ The transaction must be signed by the protocol admin.
    1. ✅ There must be no input utxo from the `vault` contract.



## Usage / Testing

1. **Deploy as `reference_scripts`**:

   ```shell
   deno task deploy-preprod
   # or
   deno task deploy-mainnet
   ```

   This will update/write results into file `data/deployed-{preprod | mainnet}.json`

   To **Un-deploy**, when updating reference scripts, or decommissioning:

   ```shell
   deno task undeploy-preprod
   # or
   deno task undeploy-mainnet
   ```

1. **Initilize `settings` and `protocol` UTXOs**

   ```shell
   deno task init-settings-preprod
   # or
   deno task init-settings-mainnet
   ```

   To un-initialize:
   ```shell
   deno task remove-settings-preprod
   # or
   deno task remove-settings-mainnet
   ```

1. **Mint some test S2 NFTs**

   ```shell
   deno task mint-s2-preprod
   ```

1. **Make a `LiveShuffle` request**

   ```shell
   deno task liveshuffle-req-preprod
   ```

   **Cancel a `LiveShuffle` or `ReShuffle` request**

   ```shell
   deno task cancel-shuffle-preprod
   ```

1. **Fulfill a `LiveShuffle` request**

   ```shell
   deno task liveshuffle-fulfill-preprod
   ```

1. **Make a `ReShuffle` request**
1. **Fulfill a `ReShuffle` request**
1. **Update settings datum**

## Todo:

1. ✅ Update `protocol` logic for `LiveShuffle`. Take into consideration that when minting, CIP68 ref tokens are also minted,
   not just user tokens.
1. Shuffle validation - add checking of lovelace amount sent back to the vault.
1. ✅ Protocol :: CancelShuffle - `user_output_valid`: replace with a check for the returned assets, not really Value "match"
1. ✅ Consider CIP68 ref tokens being sent to refscriptsAddr when classifying outputs for LiveShuffle
1. ✅ Include refscriptsAddr in settings UTXO
1. ✅ Use lucid's redeemer builder for settings and protocol utxo validation

## Winding Down:

1. Spend the utxo locked in the protocol contract:
   ```
   deno task retire-protocol-[emulate|preprod|mainnet]
   ```
1. Spend the utxo locked in the settings contract:
   ```
   deno task remove-settings-[emulate|preprod|mainnet]
   ```
1. Undeploy reference scripts:
   ```
   deno task undeploy-[emulate|preprod|mainnet]
   ```

## Random Notes:

- Quickly convert utf8 to hex string via cli: `echo -n "string" | xxd -ps -c 1000`
