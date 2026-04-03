# @iexec-nox/hardhat-nox

A [Hardhat 3](https://hardhat.org) plugin that spins up a complete local Nox off-chain stack for testing confidential smart contracts.

When your test opens a Hardhat network connection, the plugin automatically starts all required Nox services (NATS, MinIO, KMS, Gateway, Ingestor, Runner) against a forked chain and exposes a `conn.nox` API for encrypting inputs, waiting for compute results, and decrypting outputs — all within a standard Hardhat test.

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Binaries](#binaries)
- [Configuration](#configuration)
- [Network setup](#network-setup)
- [Usage in tests](#usage-in-tests)
- [API reference](#api-reference)
- [How it works](#how-it-works)
- [Troubleshooting](#troubleshooting)

---

## Requirements

- Node.js 22+
- Hardhat 3
- viem 2
- `@iexec-nox/handle` SDK
- Nox binaries (see [Binaries](#binaries))

---

## Installation

```bash
pnpm add -D @iexec-nox/hardhat-nox hardhat viem @iexec-nox/handle
```

---

## Binaries

The plugin runs six native binaries to form the local Nox stack. They must be present before any test that connects to the network.

### Default location

```text
~/.cache/hardhat-nox/poc/<os>-<arch>/
├── nats-server
├── minio
├── nox-kms
├── nox-handle-gateway
├── nox-ingestor
└── nox-runner
```

Where `<os>` is `linux` or `darwin` and `<arch>` is `x64` or `arm64`.

### Override via environment variables

Each binary path can be overridden individually:

| Variable           | Binary             |
| ------------------ | ------------------ |
| `NOX_BIN_NATS`     | NATS server        |
| `NOX_BIN_MINIO`    | MinIO server       |
| `NOX_BIN_KMS`      | Nox KMS            |
| `NOX_BIN_GATEWAY`  | Nox Handle Gateway |
| `NOX_BIN_INGESTOR` | Nox Ingestor       |
| `NOX_BIN_RUNNER`   | Nox Runner         |

---

## Configuration

Register the plugin and add the `nox` block to your `hardhat.config.ts`:

```typescript
import { defineConfig } from "hardhat/config";
import NoxPlugin from "@iexec-nox/hardhat-nox";

export default defineConfig({
  plugins: [NoxPlugin],
  nox: {
    enabled: true,
    contractAddress: "0xd464B198f06756a1d00be223634b85E0a731c229",
  },
});
```

### `nox` options

| Option            | Type             | Default   | Description                                                                                                          |
| ----------------- | ---------------- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| `enabled`         | `boolean`        | `true`    | Set to `false` to load the plugin without starting any services (useful in fixture projects or CI without binaries). |
| `contractAddress` | `string`         | —         | **Required.** Address of the deployed `NoxCompute` proxy contract on the target chain.                               |
| `ports`           | `NoxPortsConfig` | see below | Override default service ports.                                                                                      |

### Default ports

| Service                        | Config key    | Default port |
| ------------------------------ | ------------- | ------------ |
| JSON-RPC proxy (internal)      | `rpc`         | 8545         |
| NATS                           | `nats`        | 4222         |
| NATS monitoring (health check) | `natsMonitor` | 8222         |
| MinIO (S3)                     | `s3`          | 9100         |
| KMS                            | `kms`         | 9000         |
| Gateway                        | `gateway`     | 3000         |
| Ingestor                       | `ingestor`    | 8090         |
| Runner                         | `runner`      | 8080         |

```typescript
nox: {
  ports: {
    nats: 4222,
    natsMonitor: 8222,
    s3: 9100,
    kms: 9000,
    gateway: 3000,
    ingestor: 8090,
    runner: 8080,
  },
}
```

---

## Network setup

The plugin is designed to run against a **forked Arbitrum Sepolia** chain. Hardhat 3 requires explicit hardfork history for non-built-in chain IDs.

```typescript
import { defineConfig } from "hardhat/config";
import NoxPlugin from "@iexec-nox/hardhat-nox";

export default defineConfig({
  plugins: [NoxPlugin],
  solidity: {
    version: "0.8.28",
  },
  chainDescriptors: {
    421614: {
      name: "Arbitrum Sepolia",
      hardforkHistory: {
        cancun: { blockNumber: 0 },
      },
    },
  },
  networks: {
    default: {
      type: "edr-simulated",
      chainId: 421614,
      forking: {
        enabled: true,
        url:
          process.env["ARBITRUM_SEPOLIA_RPC_URL"] ??
          "https://sepolia-rollup.arbitrum.io/rpc",
      },
    },
  },
  nox: {
    enabled: true,
    contractAddress: "0xd464B198f06756a1d00be223634b85E0a731c229",
  },
});
```

> **`chainDescriptors`:** Hardhat's EDR engine refuses to execute at a fork block if it does not know the hardfork schedule for the chain. Setting `cancun: { blockNumber: 0 }` tells it that Cancun applies from genesis, which is correct for Arbitrum Sepolia.
> **Fork patching:** When a connection is opened, the plugin automatically impersonates the `NoxCompute` contract owner and calls `setGateway()` and `setKmsPublicKey()` to swap the production on-chain addresses for the local test keys. This happens transparently before any test service starts.

---

## Usage in tests

The full hello-world example is in [`packages/example-project`](../example-project). Below is a condensed walkthrough.

```typescript
import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import {
  createHardhatRuntimeEnvironment,
  importUserConfig,
  resolveHardhatConfigPath,
} from "hardhat/hre";
import { createWalletClient, custom, encodeFunctionData } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import path from "node:path";

// Hardhat default account #0
const OWNER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

describe("My confidential contract", () => {
  let hre: any;
  let conn: any;

  before(async () => {
    const configPath = await resolveHardhatConfigPath(
      path.join(import.meta.dirname, "../hardhat.config.ts"),
    );
    const userConfig = await importUserConfig(configPath);
    hre = await createHardhatRuntimeEnvironment(
      userConfig,
      { config: configPath },
      path.dirname(configPath),
    );
    // Opening the connection starts all Nox services.
    conn = await hre.network.connect();
  });

  after(async () => {
    if (conn) await conn.close();
  });

  it("encrypts, computes, and decrypts", async () => {
    const account = privateKeyToAccount(OWNER_KEY);

    const walletClient = createWalletClient({
      chain: arbitrumSepolia,
      transport: custom(conn.provider),
      account,
    });

    // 1. Deploy your confidential contract
    const deployHash = await conn.provider.request({
      method: "eth_sendTransaction",
      params: [
        { from: account.address, data: CONTRACT_BYTECODE, gas: "0x500000" },
      ],
    });
    const receipt = await conn.provider.request({
      method: "eth_getTransactionReceipt",
      params: [deployHash],
    });
    const contractAddress = receipt.contractAddress;

    // 2. Create a HandleClient backed by the local stack
    const handleClient = await conn.nox.createHandleClient(walletClient);

    // 3. Encrypt an input value bound to your contract
    const { handle, handleProof } = await handleClient.encryptInput(
      42n,
      "uint256",
      contractAddress,
    );

    // 4. Call your contract with the encrypted handle + proof
    await conn.provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: account.address,
          to: contractAddress,
          data: encodeFunctionData({
            abi: CONTRACT_ABI,
            functionName: "deposit",
            args: [handle, handleProof],
          }),
        },
      ],
    });

    // 5. Read the result handle from contract state
    const resultHandle = /* read from contract */ "" as `0x${string}`;

    // 6. Wait for the Nox pipeline to process the compute request
    await conn.nox.waitForCompute(resultHandle, handleClient, 60_000);

    // 7. Decrypt and assert
    const { value } = await handleClient.decrypt(resultHandle);
    assert.equal(value, 42n);
  });
});
```

### Disabling the stack in fixture projects

Set `enabled: false` to load the plugin without starting any services:

```typescript
export default defineConfig({
  plugins: [NoxPlugin],
  nox: { enabled: false },
});
```

---

## API reference

`conn.nox` is available on any `NetworkConnection` when `nox.enabled` is `true`.

### `conn.nox.createHandleClient(walletClient)`

```typescript
createHandleClient(walletClient: WalletClient): Promise<HandleClient>
```

Creates an `@iexec-nox/handle` SDK client pointed at the local Gateway. Use it to encrypt inputs and decrypt results.

`walletClient` must be a viem `WalletClient` backed by `conn.provider`.

### `conn.nox.getContractAddress()`

```typescript
getContractAddress(): string
```

Returns the address of the `NoxCompute` contract in use. Throws if the connection has not been opened yet.

### `cleanupNoxProcesses()`

```typescript
import { cleanupNoxProcesses } from "@iexec-nox/hardhat-nox";
```

Kills any Nox service processes left over from a previous crashed or interrupted test run. Uses the resolved binary paths so only processes started by this plugin installation are targeted — an unrelated `nats-server` or `minio` instance on the same machine is not affected.

Call it in a `before()` hook to guarantee a clean slate:

```typescript
import { cleanupNoxProcesses } from "@iexec-nox/hardhat-nox";

before(() => cleanupNoxProcesses());
```

Or from the command line to clean up manually:

```bash
node -e "import('@iexec-nox/hardhat-nox').then(m => m.cleanupNoxProcesses())"
```

---

### `conn.nox.waitForCompute(resultHandle, handleClient, timeoutMs?)`

```typescript
waitForCompute(
  resultHandle: string,
  handleClient: HandleClient,
  timeoutMs?: number,  // default: 30 000
): Promise<void>
```

Polls the Gateway until the key material for `resultHandle` is available, then resolves. Throws if the timeout elapses.

- `resultHandle` — the **result** handle read from your contract's state after the compute transaction has mined. This is not the input handle returned by `encryptInput`.
- `handleClient` — the same client used to encrypt the input. Required to generate the authenticated probe the Gateway expects.
- `timeoutMs` — maximum wait time in milliseconds. Integration tests typically need 30–60 seconds depending on machine speed.

---

## How it works

```text
hardhat.config.ts  (nox.enabled = true)

hre.network.connect()
  └─ newConnection hook fires
       │
       ├─ JSON-RPC proxy    :8545   bridges Hardhat in-process EVM to TCP
       ├─ NATS              :4222   message bus between Ingestor and Runner
       ├─ MinIO             :9100   local object store for encrypted handles
       │
       ├─ Fork patch                impersonates NoxCompute owner,
       │                            calls setGateway() + setKmsPublicKey()
       │                            with local test keys
       │
       ├─ KMS               :9000   key management, signs compute proofs
       ├─ Gateway           :3000   encrypts inputs, serves decryption to SDK
       ├─ Ingestor          :8090   watches chain events, publishes to NATS
       └─ Runner            :8080   processes compute jobs, stores results

conn.nox  ← ready

conn.close()
  └─ closeConnection hook fires
       └─ all services stopped in reverse order
```

Each service is health-checked before the next one starts (30-second timeout per service). Total startup typically takes 5–15 seconds on a local machine.

### Fork patching in detail

The `NoxCompute` contract on Arbitrum Sepolia holds the addresses of the **production** gateway and KMS. To make the local stack work, the plugin patches the contract at startup using Hardhat's `hardhat_impersonateAccount`:

1. Reads the contract owner via `owner()` (EIP-55 selector `0x8da5cb5b`).
2. Funds the owner address with 1 ETH via `hardhat_setBalance`.
3. Calls `setGateway(localGatewayAddress)` — accepts proofs signed by the local gateway key.
4. Calls `setKmsPublicKey(localEccPublicKey)` — Gateway encrypts handles with the local KMS key.

This makes the forked chain behave exactly like a fresh local deployment for test purposes.

---

## Troubleshooting

### `EADDRINUSE: address already in use`

A previous test run crashed and left a service running. The easiest fix is `cleanupNoxProcesses`, which kills only the plugin's own processes:

```typescript
import { cleanupNoxProcesses } from "@iexec-nox/hardhat-nox";

before(() => cleanupNoxProcesses());
```

Or manually for a specific port:

```bash
# Linux
kill $(ss -tlnp | grep ':8545' | grep -oP 'pid=\K[0-9]+')

# macOS
lsof -ti :8545 | xargs kill
```

### `Timeout waiting for ... to become healthy`

The binary failed to start. Check that:

1. The binary exists at the expected path (`~/.cache/hardhat-nox/poc/<os>-<arch>/`).
2. The binary has execute permission (`chmod +x <binary>`).
3. No other process is using the same port.

Each service logs to stdout/stderr prefixed with its name (e.g. `[nox-kms]`). Run the test with stderr visible to see startup errors.

### `nox.contractAddress must be set`

The `contractAddress` field is missing from your `hardhat.config.ts`. For Arbitrum Sepolia the address is `0xd464B198f06756a1d00be223634b85E0a731c229`.

### `No known hardfork for execution on historical block ...`

The `chainDescriptors` entry for chain 421614 is missing. Add it to your config as shown in [Network setup](#network-setup).

### `waitForCompute` times out

The Runner did not process the result within the timeout. Common causes:

- The compute transaction was not sent to the address in `nox.contractAddress`.
- The Gateway or Runner exited — check their log lines for errors.
- The machine is slow — increase the timeout: `conn.nox.waitForCompute(handle, client, 120_000)`.
