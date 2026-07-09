import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Address } from "viem";
import { createPublicClient, createTestClient, http } from "viem";
import { hardhat } from "viem/chains";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { FileBuildResultType } from "hardhat/types/solidity";
import { setResolvedNoxComputeAddress } from "../nox-config.js";
import { loadDeploymentArtifact } from "./artifacts.js";

const RESOLVER_SCRATCH_ADDRESS = "0x9ae8112849021f70ff7dfd6a227140c4f441ba30";

const RESOLVER_SOURCE_PATH = path.join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "contracts",
  "NoxComputeAddressResolver.sol",
);

/**
 * Copies the plugin's shipped NoxComputeAddressResolver.sol into the
 * consuming project's own Hardhat cache dir, so that when it's built, its
 * `@iexec-nox/nox-protocol-contracts` import resolves through the
 * consumer's own `node_modules` — the same way any of the consumer's own
 * contracts would — rather than through the plugin's own (possibly
 * `file:`-linked) location. Always overwrites, so there's no staleness
 * question if the plugin's shipped source changes between versions.
 */
async function stageResolverSource(
  hre: HardhatRuntimeEnvironment,
): Promise<string> {
  const stagedDir = path.join(hre.config.paths.cache, "nox-hardhat-plugin");
  const stagedPath = path.join(stagedDir, "NoxComputeAddressResolver.sol");
  await mkdir(stagedDir, { recursive: true });
  const source = await readFile(RESOLVER_SOURCE_PATH, "utf-8");
  await writeFile(stagedPath, source);
  return stagedPath;
}

/**
 * Stages a copy of the plugin's shipped `NoxComputeAddressResolver.sol`
 * inside the consuming project, then builds it against that project's own
 * Solidity toolchain (via `hre.solidity.build`), etches its runtime
 * bytecode at a scratch address, and calls its getter to read back the
 * address `Nox.noxComputeContract()` resolves to for the current chain.
 * The scratch address is reset to empty right after, so this leaves no
 * trace on chain (no deployer transaction, no nonce consumed). The resolved
 * address is also stashed via `setResolvedNoxComputeAddress` so later calls
 * (e.g. from `nox.connect()`) can read it back cheaply.
 */
export async function resolveNoxComputeAddressViaResolver(
  hre: HardhatRuntimeEnvironment,
  rpcUrl: string,
): Promise<Address> {
  const stagedPath = await stageResolverSource(hre);

  // NoxComputeAddressResolver.sol must be built ahead of time to find it among generated artifacts
  await hre.solidity.build([stagedPath], {
    quiet: true,
  });
  // this build hits cache
  const buildResult = await hre.solidity.build([stagedPath], {
    quiet: true,
  });

  if (!hre.solidity.isSuccessfulBuildResult(buildResult)) {
    throw new Error(
      `[nox] Failed to build NoxComputeAddressResolver.sol: ${buildResult.formattedReason}`,
    );
  }

  const fileResult = buildResult.get(stagedPath);
  if (fileResult === undefined) {
    throw new Error(
      `[nox] hre.solidity.build() returned no result for ${stagedPath}.`,
    );
  }
  if (fileResult.type === FileBuildResultType.BUILD_FAILURE) {
    throw new Error(
      `[nox] Failed to compile NoxComputeAddressResolver.sol: ${JSON.stringify(fileResult.errors)}`,
    );
  }

  const artifactPath = fileResult.contractArtifactsGenerated.find(
    (generatedPath) => generatedPath.endsWith("NoxComputeAddressResolver.json"),
  );
  if (artifactPath === undefined) {
    throw new Error(
      `[nox] Could not find NoxComputeAddressResolver.json among generated artifacts: ${fileResult.contractArtifactsGenerated.join(", ")}`,
    );
  }
  const resolver = await loadDeploymentArtifact(artifactPath);

  const transport = http(rpcUrl);
  const testClient = createTestClient({
    mode: "hardhat",
    chain: hardhat,
    transport,
  });
  const publicClient = createPublicClient({ chain: hardhat, transport });

  await testClient.setCode({
    address: RESOLVER_SCRATCH_ADDRESS,
    bytecode: resolver.deployedBytecode,
  });
  let noxComputeAddress: Address;
  try {
    noxComputeAddress = (await publicClient.readContract({
      address: RESOLVER_SCRATCH_ADDRESS,
      abi: resolver.abi,
      functionName: "noxComputeAddress",
    })) as Address;
  } finally {
    await testClient.setCode({
      address: RESOLVER_SCRATCH_ADDRESS,
      bytecode: "0x",
    });
  }
  setResolvedNoxComputeAddress(noxComputeAddress);
  return noxComputeAddress;
}
