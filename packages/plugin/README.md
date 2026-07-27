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
transitively). Installing without it fails the first `nox.connect()` call
against an `edr-simulated` network with a clear error, as soon as the local
stack tries to start.

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
      chainId: 31337, // nox plugin supports hardhat node default chain id
    },
  },
});
```

## Usage

The plugin provides Nox methods (`encryptInput`, `decrypt` and `publicDecrypt`) for a `NetworkConnection`.

Enable the plugin in your `hardhat.config.ts`

```ts
import { defineConfig } from "hardhat/config";
import noxPlugin from "@iexec-nox/nox-hardhat-plugin";

export default defineConfig({
  plugins: [noxPlugin],
});
```

Use Nox in your hardhat scripts

```ts
import { network } from "hardhat";
import { nox } from "@iexec-nox/nox-hardhat-plugin";

const connection = await network.getOrCreate();
const { encryptInput, decrypt, publicDecrypt } = await nox.connect(connection);
```

### Using with hardhat default `edr-simulated` network

The first call to `nox.connect` with the hardhat default network brings up a local Nox stack attached to the network:

1. `NoxCompute` is injected at a predefined address
2. a RPC relayer is attached to the connection
3. Nox offchain stack is started via Docker Compose against the RPC relayer

> ℹ️ The stack is started once per independant `NetworkConnection`; use `network.getOrCreate()` to reuse the existing connection across test suites.
>
> **Known limitation**: using multiple instances of `edr-simulated` network in parallel is currently not supported.

### Connecting to an existing Nox stack

Instead of the plugin's own local stack, `nox.connect()` can target a Nox
stack that's already running elsewhere (a private testnet, a public network,
or just a longer-lived local stack you kept up on purpose). Declare it on the
network itself:

```ts
export default defineConfig({
  plugins: [noxPlugin],
  networks: {
    existingStack: {
      type: "http",
      url: "https://rpc.example.com",
      nox: {
        noxComputeAddress: "0x...",
        handleGatewayUrl: "https://gateway.example.com",
      },
    },
  },
});
```

Both fields are required together, and this is purely declarative — the plugin never deploys, discovers, or verifies the stack behind these values; it
assumes it already exists and is reachable:

```ts
const connection = await network.getOrCreate({ network: "existingStack" });
const { noxComputeAddress, handleGatewayUrl } = await nox.connect(connection);
```

Only `http` networks can carry a `nox` config — `edr-simulated` networks are
re-created fresh on every `network.create()` call, so there's nothing
"already running" for them to point at; they can only use the plugin's own
local stack.

## The `nox` runtime API

```ts
import { network } from "hardhat";
import { nox } from "@iexec-nox/nox-hardhat-plugin";

const connection = await network.getOrCreate();

const {
  noxComputeAddress,
  handleGatewayUrl,
  encryptInput,
  decrypt,
  publicDecrypt,
} = await nox.connect(connection);

await encryptInput(value, solidityType, applicationContract);
await decrypt(handle);
await publicDecrypt(handle);
```
