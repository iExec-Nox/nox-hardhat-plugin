import type { Address } from "viem";
import { createPublicClient, createTestClient, http } from "viem";
import { hardhat } from "viem/chains";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { FileBuildResultType } from "hardhat/types/solidity";
import { NOX_SHIM_ROOT_PATH } from "../nox-config.js";
import { loadDeploymentArtifact } from "./artifacts.js";

const NOX_SHIM_SCRATCH_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Builds the plugin's shipped `NoxShim.sol` against the consuming project's
 * own Solidity toolchain (via `hre.solidity.build`), etches its runtime
 * bytecode at a scratch address, and calls its getter to read back the
 * address `Nox.noxComputeContract()` resolves to for the current chain.
 * The scratch address is reset to empty right after, so this leaves no
 * trace on chain (no deployer transaction, no nonce consumed).
 */
export async function resolveNoxComputeAddressViaShim(
  hre: HardhatRuntimeEnvironment,
  rpcUrl: string,
): Promise<Address> {
  // NoxShim.sol must be built ahead of time to find it among generated artifacts
  await hre.solidity.build([NOX_SHIM_ROOT_PATH], {
    quiet: true,
  });
  // this build hits cache
  const buildResult = await hre.solidity.build([NOX_SHIM_ROOT_PATH], {
    quiet: true,
  });

  if (!hre.solidity.isSuccessfulBuildResult(buildResult)) {
    throw new Error(
      `[nox] Failed to build NoxShim.sol: ${buildResult.formattedReason}`,
    );
  }

  const fileResult = buildResult.get(NOX_SHIM_ROOT_PATH);
  if (fileResult === undefined) {
    throw new Error(
      `[nox] hre.solidity.build() returned no result for ${NOX_SHIM_ROOT_PATH}.`,
    );
  }
  if (fileResult.type === FileBuildResultType.BUILD_FAILURE) {
    throw new Error(
      `[nox] Failed to compile NoxShim.sol: ${JSON.stringify(fileResult.errors)}`,
    );
  }

  const artifactPath = fileResult.contractArtifactsGenerated.find((path) =>
    path.endsWith("NoxShim.json"),
  );
  if (artifactPath === undefined) {
    throw new Error(
      `[nox] Could not find NoxShim.json among generated artifacts: ${fileResult.contractArtifactsGenerated.join(", ")}`,
    );
  }
  const shim = await loadDeploymentArtifact(artifactPath);

  const transport = http(rpcUrl);
  const testClient = createTestClient({
    mode: "hardhat",
    chain: hardhat,
    transport,
  });
  const publicClient = createPublicClient({ chain: hardhat, transport });

  await testClient.setCode({
    address: NOX_SHIM_SCRATCH_ADDRESS,
    bytecode: shim.deployedBytecode,
  });
  try {
    return (await publicClient.readContract({
      address: NOX_SHIM_SCRATCH_ADDRESS,
      abi: shim.abi,
      functionName: "noxComputeAddress",
    })) as Address;
  } finally {
    await testClient.setCode({
      address: NOX_SHIM_SCRATCH_ADDRESS,
      bytecode: "0x",
    });
  }
}
