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
