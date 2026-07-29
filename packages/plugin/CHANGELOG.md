# Changelog

## [0.2.0](https://github.com/iExec-Nox/nox-hardhat-plugin/compare/v0.1.0...v0.2.0) (2026-07-29)


### ⚠ BREAKING CHANGES

* **nox:** `nox.connect()` now requires a `NetworkConnection` argument instead of taking none, and returns a standalone object (`noxComputeAddress`/`handleGatewayUrl`/`encryptInput`/`decrypt`/`publicDecrypt`) rather than merging those onto the connection — use `.viem`/`.ethers`/`.provider`/`.close()` directly off the connection you passed in. `nox` no longer exposes `encryptInput`, `decrypt`, `publicDecrypt`, `noxComputeAddress`, or `handleGatewayUrl` as top-level members. The plugin no longer overrides Hardhat's `test` task, so `nox.skipTestOverride` config and hardhat test auto-starting the local stack are gone; call `nox.connect()` (e.g. in a fixture/setup) to start it instead.
* `NOX_COMPUTE_ADDRESS`, `handleGatewayUrl`, and `RPC_URL` are no longer exported from the package. `@iexec-nox/nox-protocol-contracts` is no longer bundled as a direct dependency of the plugin — it's now a peerDependency, so consuming projects must install it themselves.

### 🚀 Added

* **nox:** add per-network config for connecting to an existing stack ([#37](https://github.com/iExec-Nox/nox-hardhat-plugin/issues/37)) ([1adcb32](https://github.com/iExec-Nox/nox-hardhat-plugin/commit/1adcb3268fdcc7136e33e03e163a4b11d1b5c431))
* **nox:** make nox.connect() the entry point for connecting to a Nox stack in any hardhat script ([#40](https://github.com/iExec-Nox/nox-hardhat-plugin/issues/40)) ([f9588fa](https://github.com/iExec-Nox/nox-hardhat-plugin/commit/f9588faa376e8dcfea52d2f008162b5b1f08c56c))
* resolve NoxCompute address using Nox.sol lib from consumer's @iexec-nox/nox-protocol-contracts ([#35](https://github.com/iExec-Nox/nox-hardhat-plugin/issues/35)) ([d9049cc](https://github.com/iExec-Nox/nox-hardhat-plugin/commit/d9049cc2af76c552dd1f14df2ebbeeb08494ea0f))


### ✍️ Changed

* **nox:** tear down local stack via exit/signal hooks  ([#41](https://github.com/iExec-Nox/nox-hardhat-plugin/issues/41)) ([9a92461](https://github.com/iExec-Nox/nox-hardhat-plugin/commit/9a92461b481291fbcc1a6900b8e87cbc19f2ad12)), closes [#31](https://github.com/iExec-Nox/nox-hardhat-plugin/issues/31)

## [0.1.0](https://github.com/iExec-Nox/nox-hardhat-plugin/compare/v0.1.0-beta.3...v0.1.0) (2026-06-22)


### 🚀 Added

* add support for Ethers with dynamic selection ([#29](https://github.com/iExec-Nox/nox-hardhat-plugin/issues/29)) ([ebac611](https://github.com/iExec-Nox/nox-hardhat-plugin/commit/ebac611fa401ffffd3ce3d3d196b135ea79e5787))
* improve handle gateway configuration and error handling ([1beef9c](https://github.com/iExec-Nox/nox-hardhat-plugin/commit/1beef9c01cf48fa9a7e15dd83fd8b6590af7fed8))

## [0.1.0-beta.3](https://github.com/iExec-Nox/nox-hardhat-plugin/compare/v0.1.0-beta.2...v0.1.0-beta.3) (2026-06-17)


### 🚀 Added

* transparent `waitForHandleResolved` ([#25](https://github.com/iExec-Nox/nox-hardhat-plugin/issues/25)) ([896163f](https://github.com/iExec-Nox/nox-hardhat-plugin/commit/896163f34b589812d5d6e24d2df83c10bdeec52b))


### ✍️ Changed

* test runner hang ([8c5038e](https://github.com/iExec-Nox/nox-hardhat-plugin/commit/8c5038e0a9c2049c78efcde8fa707310923f4cee))

## [0.1.0-beta.2](https://github.com/iExec-Nox/nox-hardhat-plugin/compare/v0.1.0-beta.1...v0.1.0-beta.2) (2026-06-15)


### ✍️ Changed

* run `NoxCompute` constructor so EIP712 immutables are set ([#19](https://github.com/iExec-Nox/nox-hardhat-plugin/issues/19)) ([15cefd4](https://github.com/iExec-Nox/nox-hardhat-plugin/commit/15cefd4bfe522d43072ffa1c56f66a785ba0ac58))

## [0.1.0-beta.1](https://github.com/iExec-Nox/nox-hardhat-plugin/compare/v0.1.0-beta.0...v0.1.0-beta.1) (2026-06-12)


### 🚀 Added

* Local stack support with Docker Compose integration ([#3](https://github.com/iExec-Nox/nox-hardhat-plugin/issues/3)) ([8f7229f](https://github.com/iExec-Nox/nox-hardhat-plugin/commit/8f7229f3294ef1ea0c4159821a69ded05ada8709))
* `nox setcode` task ([#4](https://github.com/iExec-Nox/nox-hardhat-plugin/issues/4)) ([d1da0ed](https://github.com/iExec-Nox/nox-hardhat-plugin/commit/d1da0ed321f3fdcab22fa69fb472912d4e9e9ec8))
* Expose SDK functions ([#10](https://github.com/iExec-Nox/nox-hardhat-plugin/issues/10)) ([3bbd1c7](https://github.com/iExec-Nox/nox-hardhat-plugin/commit/3bbd1c7ab756b3462b1bdc029f0399ba514833d2))
* ERC-7984 end-to-end example ([#5](https://github.com/iExec-Nox/nox-hardhat-plugin/issues/5)) ([27c0ee9](https://github.com/iExec-Nox/nox-hardhat-plugin/commit/27c0ee90d593e8529a2d8eeb1caf8efef7bcf910))
