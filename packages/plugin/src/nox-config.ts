import { createRequire } from "node:module";
import path from "node:path";
import type { IDockerComposeOptions } from "docker-compose";
import type { Address, Hex } from "viem";

// The only chain id the plugin's local stack supports (Hardhat default).
// Other chain ids log a warning and skip stack setup — the user's tests then
// run against the network's real endpoint and may fail if it lacks a Nox
// deployment.
export const NOX_SUPPORTED_CHAIN_ID = 31337;

// Arbitrary address at which the plugin etches the NoxCompute implementation
// runtime.
export const NOX_COMPUTE_IMPL_ADDRESS: Address =
  "0x8D88B61356Fa291505d3E3D3a77e19fad0958fe3";

// ERC-1967 implementation slot — hardcoded in the shipped proxy bytecode. We
// write it ourselves because `hardhat_setCode` bypasses the proxy constructor.
export const ERC1967_IMPLEMENTATION_SLOT: Hex =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

export const NOX_KMS_PUBLIC_KEY: Hex =
  "0x03902284a6bd5198b4a32ef2319fc3ae37ea166aff0320eaa8addb0182ee80381e";
export const NOX_GATEWAY_ADDRESS: Address =
  "0xE1a6B1De3AbF04e7FA5355373880350Dc3004D0e";

export const HANDLE_GATEWAY_SERVICE = "nox-handle-gateway";
export const HANDLE_GATEWAY_CONTAINER_PORT = 3000;

export const DOCKER_PING_TIMEOUT_MS = 2000;

// How long `decrypt`/`publicDecrypt` poll the gateway for a handle to be
// resolved before giving up: 60 attempts × 0.1s = 6s.
export const RESOLVE_MAX_RETRIES = 60;
export const RESOLVE_DELAY_MS = 100;

/**
 * Resolves the `NoxCompute` deployment artifact from the *consuming*
 * project's own `@iexec-nox/nox-protocol-contracts` (a peerDependency),
 * rather than the plugin's own — so the contract etched on the local node
 * matches the version the consumer actually depends on. Throws a clear
 * error if the consumer hasn't installed it.
 */
export function resolveNoxComputeArtifactPath(consumerRoot: string): string {
  const consumerRequire = createRequire(
    path.join(consumerRoot, "package.json"),
  );
  try {
    return consumerRequire.resolve(
      "@iexec-nox/nox-protocol-contracts/artifacts/contracts/NoxCompute.sol/NoxCompute.json",
    );
  } catch (err) {
    throw new Error(
      `[nox] Could not resolve "@iexec-nox/nox-protocol-contracts" from your Hardhat project (${consumerRoot}). The plugin deploys the exact version your project depends on; make sure it is installed as a direct dependency. Underlying error: ${String(err)}`,
    );
  }
}

export const ERC1967_PROXY_ARTIFACT_PATH = createRequire(
  import.meta.url,
).resolve("@openzeppelin/contracts/build/contracts/ERC1967Proxy.json");

export const COMPOSE_OPTS: IDockerComposeOptions = {
  cwd: path.resolve(import.meta.dirname, "..", "..", "offchain-services"),
  log: false,
  composeOptions: [["--env-file", "dev.env"]],
};

export const ALL_SERVICES = [
  "nats",
  "s3",
  "nox-kms",
  "nox-handle-gateway",
  "nox-ingestor",
  "nox-runner",
];
