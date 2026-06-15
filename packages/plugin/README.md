# `@iexec-nox/nox-hardhat-plugin`

Hardhat 3 plugin that spins up the Nox offchain stack (KMS, ingestor, runner,
handle gateway, NATS, S3) with Docker Compose and injects the `NoxCompute`
contract bytecode on the local node, so tests and scripts can exercise the full
Nox protocol end-to-end.

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

### Process hangs after tests finish

The plugin calls `process.exit()` after teardown by default to prevent
open undici keep-alive sockets (from `fetch()` calls in tests) from keeping
the event loop alive. See
[#21](https://github.com/iExec-Nox/nox-hardhat-plugin/issues/21).

If you call `hre.run("test")` **programmatically** and need the process to
remain alive after the test run, opt out of the forced exit:

```ts
export default defineConfig({
  nox: { forceExitAfterTest: false },
  // …
});
```
