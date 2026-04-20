import { createRequire } from "node:module";
import path from "node:path";
import { IDockerComposeOptions } from "docker-compose";

// Canonical NoxCompute addresses on Arbitrum Sepolia — the plugin etches the
// production runtime bytecode at these exact addresses so that contracts that
// rely on `Nox.noxComputeContract()` (from `@iexec-nox/nox-protocol-contracts`)
// hit the proxy transparently.
export const NOX_COMPUTE_PROXY_ADDRESS =
  "0xd464B198f06756a1d00be223634b85E0a731c229";
export const NOX_COMPUTE_IMPL_ADDRESS =
  "0x8D88B61356Fa291505d3E3D3a77e19fad0958fe3";

// ERC-1967 implementation slot — hardcoded in the shipped proxy bytecode. We
// write it ourselves because `hardhat_setCode` bypasses the proxy constructor.
export const ERC1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

export const NOX_KMS_PUBLIC_KEY =
  "0x03902284a6bd5198b4a32ef2319fc3ae37ea166aff0320eaa8addb0182ee80381e";
export const NOX_GATEWAY_ADDRESS = "0xE1a6B1De3AbF04e7FA5355373880350Dc3004D0e";

export const HANDLE_GATEWAY_URL = "http://localhost:3000";
export const RPC_URL = "http://127.0.0.1:8545";

// Ignition deployment artifacts shipped by `@iexec-nox/nox-protocol-contracts`
// on npm (since v0.2.2). We reuse the production-compiled bytecode instead of
// recompiling NoxCompute.sol from source — that guarantees a byte-exact match
// with what's deployed on chain and what the KMS/ingestor were tested against.
const pluginRequire = createRequire(import.meta.url);
export const NOX_PROTOCOL_DEPLOYMENTS_DIR = path.resolve(
  path.dirname(
    pluginRequire.resolve("@iexec-nox/nox-protocol-contracts/package.json"),
  ),
  "ignition",
  "deployments",
  "arbitrumSepolia",
  "artifacts",
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
