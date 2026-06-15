# `@iexec-nox/nox-hardhat-plugin`

Hardhat 3 plugin that spins up the Nox offchain stack (KMS, ingestor, runner,
handle gateway, NATS, S3) with Docker Compose and injects the `NoxCompute`
contract bytecode on the local node, so tests and scripts can exercise the full
Nox protocol end-to-end.

## Requirements

- **Docker** must be running before you execute `hardhat test`. The plugin starts
  six services via Docker Compose (NATS, MinIO/S3, KMS, handle gateway, ingestor,
  runner) and tears them down after the run. Docker Desktop, OrbStack, and Colima
  all work.

- **Hardhat 3** — this plugin is not compatible with Hardhat 2.

## Installation

```bash
pnpm add -D @iexec-nox/nox-hardhat-plugin
```

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
   `@iexec-nox/nox-protocol-contracts`).
2. Starts a Hardhat node bound to `0.0.0.0:8545`.
3. Injects the compiled `NoxCompute` bytecode at its well-known address via
   `hardhat_setCode` and initializes it (owner + KMS public key + gateway).
4. Brings up the Nox offchain stack via Docker Compose and waits for every
   service to be healthy.

```bash
pnpm hardhat test
```

The stack is torn down when the test run finishes (or on failure).

## Troubleshooting

### `[nox] Docker is not running or unreachable`

Start your Docker runtime before running `hardhat test`:

```bash
# Docker Desktop — start from the application
# OrbStack
open -a OrbStack
# Colima
colima start
```

### `[nox] Port 3000 appears to be occupied by a non-Nox service`

Something else (e.g. a Next.js dev server) is listening on port 3000. Stop it
before running tests:

```bash
# find and kill whatever is on port 3000
lsof -ti :3000 | xargs kill
```

### `solidity: "0.8.35"` raises `HHE903: Solidity version … hasn't been released yet`

Hardhat's bundled version list may lag behind the latest `solc` releases. Switch
to the explicit `profiles` format to force a direct download from soliditylang.org:

```ts
solidity: {
  profiles: {
    default: { version: "0.8.35" },
  },
},
```

### Process hangs after tests finish

Upgrade to `@iexec-nox/nox-hardhat-plugin` ≥ 0.1.0-beta.2 which includes
`process.exit()` after teardown. See
[#21](https://github.com/iExec-Nox/nox-hardhat-plugin/issues/21).
