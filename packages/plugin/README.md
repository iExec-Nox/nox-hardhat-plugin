# `@iexec-nox/nox-hardhat-plugin`

Hardhat 3 plugin that spins up the Nox offchain stack (KMS, ingestor, runner,
handle gateway, NATS, S3) with Docker Compose and injects the `NoxCompute`
contract bytecode on the local node, so tests and scripts can exercise the full
Nox protocol end-to-end.

## Installation

```bash
pnpm add -D @iexec-nox/nox-hardhat-plugin
```

`@iexec-nox/nox-protocol-contracts` is a required peer dependency: the plugin
deploys the exact `NoxCompute` version your project depends on, so it must be
declared as a direct dependency of your own project (not just pulled in
transitively). Installing without it fails `hardhat test` with a clear error
as soon as the local stack tries to start.

In your `hardhat.config.ts`:

```ts
import { defineConfig } from "hardhat/config";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import noxPlugin from "@iexec-nox/nox-hardhat-plugin";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin, noxPlugin],
  solidity: "0.8.29",
  networks: {
    default: {
      type: "edr-simulated",
      chainType: "op",
      allowUnlimitedContractSize: true,
    },
  },
});
```

## Usage

The plugin overrides the `test` task so that, before running your tests, it:

1. Compiles the project (including the `NoxCompute` contract pulled from
   _your_ project's own `@iexec-nox/nox-protocol-contracts` dependency.
2. Starts a Hardhat node bound to `0.0.0.0:8545`.
3. Injects the compiled `NoxCompute` bytecode at its well-known address via
   `hardhat_setCode` and initializes it (owner + KMS public key + gateway).
4. Brings up the Nox offchain stack via Docker Compose and waits for every
   service to be healthy.

```bash
pnpm hardhat test
```

The stack is torn down when the test run finishes (or on failure).

## Connecting to an existing Nox stack

Instead of the plugin's own ephemeral local stack, `hardhat test` can target a Nox stack that's already running elsewhere (a private testnet, a public network, or just a longer-lived local stack you kept up on purpose). Declare it on the network itself:

```ts
export default defineConfig({
  plugins: [noxPlugin],
  networks: {
    existingStack: {
      type: "http",
      url: "https://rpc.example.com",
      chainType: "op",
      nox: {
        noxComputeAddress: "0x...",
        handleGatewayUrl: "https://gateway.example.com",
      },
    },
  },
});
```

Both fields are required together, and this is purely declarative — the plugin never deploys, discovers, or verifies the stack behind these values; it assumes it already exists and is reachable. Run `pnpm hardhat test --network existingStack` and the plugin skips starting its own node and Docker Compose stack entirely, running your tests directly against the configured stack. This is independent of chain id (an existing stack can be on any chain) and orthogonal to `nox.skipTestOverride` (which still means "no Nox handling at all").

Only `http` networks can carry a `nox` config — `edr-simulated` networks can only use an ephemeral Nox stack.

## The `nox` runtime API

```ts
import { nox } from "@iexec-nox/nox-hardhat-plugin";

const conn = await nox.connect(); // resolves the active network once
conn.viem / conn.ethers; // as returned by `network.create()`
conn.noxComputeAddress; // resolved at connect() time
conn.handleGatewayUrl; // resolved at connect() time
await conn.encryptInput(value, solidityType, applicationContract);
await conn.decrypt(handle);
await conn.publicDecrypt(handle);
```

`nox.connect()` targets whichever network is currently active (`--network`, or the default network) — if that network carries a `nox` config (see above), it connects to that existing stack directly; otherwise it falls back to the plugin's own local stack.
