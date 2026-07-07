import type { Address } from "viem";
import { createWalletClient, http, publicActions } from "viem";
import { hardhat } from "viem/chains";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { FileBuildResultType } from "hardhat/types/solidity";
import { NOX_SHIM_ROOT_PATH } from "../nox-config.js";
import { loadDeploymentArtifact } from "./artifacts.js";

/**
 * deploys the plugin's shipped `NoxShim.sol` against the consuming
 * project's own Solidity toolchain (via `hre.solidity.build`)
 * and calls its getter to read back the address `Nox.noxComputeContract()`
 * resolves to for the current chain
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
  const walletClient = createWalletClient({ chain: hardhat, transport }).extend(
    publicActions,
  );
  const [deployer] = await walletClient.getAddresses();
  if (deployer === undefined)
    throw new Error("[nox] Could not find a signer on the target node.");

  const deployHash = await walletClient.deployContract({
    abi: shim.abi,
    bytecode: shim.bytecode,
    account: deployer,
    chain: hardhat,
  });
  const { contractAddress: shimAddress } =
    await walletClient.waitForTransactionReceipt({ hash: deployHash });
  if (!shimAddress) throw new Error("[nox] NoxShim deployment failed.");

  return walletClient.readContract({
    address: shimAddress,
    abi: shim.abi,
    functionName: "noxComputeAddress",
  }) as Promise<Address>;
}
