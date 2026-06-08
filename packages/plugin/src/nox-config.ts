import { createRequire } from "node:module";
import path from "node:path";
import type { IDockerComposeOptions } from "docker-compose";
import type { Address, Hex } from "viem";

export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
export const SEPOLIA_CHAIN_ID = 11155111;

export const NOX_COMPUTE_CONTRACT: Record<number, Address> = {
  [ARBITRUM_SEPOLIA_CHAIN_ID]: "0xd464B198f06756a1d00be223634b85E0a731c229",
  [SEPOLIA_CHAIN_ID]: "0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF",
};

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

export const HANDLE_GATEWAY_URL = "http://localhost:3000";
export const RPC_URL = "http://127.0.0.1:8545";

const pluginRequire = createRequire(import.meta.url);
export const NOX_COMPUTE_ARTIFACT_PATH = pluginRequire.resolve(
  "@iexec-nox/nox-protocol-contracts/artifacts/contracts/NoxCompute.sol/NoxCompute.json",
);

export const ERC1967_PROXY_ARTIFACT_PATH = pluginRequire.resolve(
  "@openzeppelin/contracts/build/contracts/ERC1967Proxy.json",
);

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
