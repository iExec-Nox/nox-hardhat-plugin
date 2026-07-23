import {
  createTestClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  pad,
  publicActions,
} from "viem";
import type { Address } from "viem";
import { hardhat } from "viem/chains";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { ChainType, NetworkConnection } from "hardhat/types/network";
import {
  ERC1967_IMPLEMENTATION_SLOT,
  ERC1967_PROXY_ARTIFACT_PATH,
  NOX_COMPUTE_IMPL_ADDRESS,
  NOX_GATEWAY_ADDRESS,
  NOX_KMS_PUBLIC_KEY,
  resolveNoxComputeArtifactPath,
} from "../nox-config.js";
import { loadDeploymentArtifact } from "./artifacts.js";

/**
 * Install NoxCompute on the target Hardhat node (chainId 31337):
 *   1. The implementation is *deployed* (not just etched) so its constructor
 *      runs and immutable variables are set. It's deployed on a throwaway
 *      connection cloned from the target's own network config but with
 *      `allowUnlimitedContractSize` forced on, since NoxCompute exceeds the
 *      EIP-170 size limit and we don't want to require every consumer to
 *      relax that limit on their own test network just for this. Only the
 *      resulting runtime bytecode survives past that connection's teardown.
 *   2. `setCode` injects the ERC1967Proxy runtime at the canonical address.
 *   3. `setStorageAt` writes the implementation address into the proxy's
 *      ERC-1967 slot (normally done by the proxy's constructor, which we
 *      bypass when etching bytecode directly).
 *   4. `initialize(admin, upgrader, kmsPublicKey, gateway)` is called on the
 *      proxy — it sets all config in the proxy's storage AND emits the
 *      zero-handle seed events that the offchain stack needs.
 */
export async function deployNoxCompute(
  hre: HardhatRuntimeEnvironment,
  connection: NetworkConnection<ChainType | string>,
  noxComputeAddress: Address,
): Promise<void> {
  const [impl, proxy] = await Promise.all([
    loadDeploymentArtifact(
      resolveNoxComputeArtifactPath(hre.config.paths.root),
    ),
    loadDeploymentArtifact(ERC1967_PROXY_ARTIFACT_PATH),
  ]);

  // NoxCompute's implementation exceeds the EIP-170 24576-byte contract size
  // limit, so it can't be deployed via a real transaction on the target
  // connection as-is — that would require the *consumer's own* network to opt
  // into `allowUnlimitedContractSize`, relaxing a check they may actually want
  // enforced for their own contracts. Instead we spin up a disposable clone of
  // the target network (same config, only `allowUnlimitedContractSize`
  // flipped on) that lives just long enough to deploy the implementation and
  // read back its runtime bytecode, then get thrown away — only that runtime
  // bytecode survives, etched onto the real target below via `setCode`, which
  // isn't subject to the size check at all.
  const sizeUnlimitedConnection = await hre.network.create({
    network: connection.networkName,
    chainType: connection.chainType,
    override: { allowUnlimitedContractSize: true },
  });
  let initializedImplRuntime: `0x${string}`;
  try {
    const sizeUnlimitedWalletClient = createWalletClient({
      chain: hardhat,
      transport: custom(sizeUnlimitedConnection.provider),
    }).extend(publicActions);

    const [sizeUnlimitedDeployer] =
      await sizeUnlimitedWalletClient.getAddresses();
    if (sizeUnlimitedDeployer === undefined)
      throw new Error(
        "[nox] Could not find a signer on the size-unlimited node.",
      );

    const implDeployHash = await sizeUnlimitedWalletClient.deployContract({
      abi: impl.abi,
      bytecode: impl.bytecode,
      account: sizeUnlimitedDeployer,
      chain: hardhat,
    });
    const { contractAddress: deployedImplAddress } =
      await sizeUnlimitedWalletClient.waitForTransactionReceipt({
        hash: implDeployHash,
      });
    if (!deployedImplAddress)
      throw new Error("[nox] NoxCompute implementation deployment failed.");
    const runtime = await sizeUnlimitedWalletClient.getCode({
      address: deployedImplAddress,
    });
    if (!runtime || runtime === "0x")
      throw new Error("[nox] Could not read deployed NoxCompute runtime code.");
    initializedImplRuntime = runtime;
  } finally {
    // Always release the disposable chain, even if the deploy above failed.
    await sizeUnlimitedConnection.close();
  }

  const transport = custom(connection.provider);
  const testClient = createTestClient({
    mode: "hardhat",
    chain: hardhat,
    transport,
  });
  const walletClient = createWalletClient({ chain: hardhat, transport }).extend(
    publicActions,
  );

  const [targetDeployer] = await walletClient.getAddresses();
  if (targetDeployer === undefined)
    throw new Error("[nox] Could not find a signer on the target node.");

  await testClient.setCode({
    address: NOX_COMPUTE_IMPL_ADDRESS,
    bytecode: initializedImplRuntime,
  });
  await testClient.setCode({
    address: noxComputeAddress,
    bytecode: proxy.deployedBytecode,
  });
  console.log(`[nox] 📦 NoxCompute deployed at ${noxComputeAddress}`);

  // Wire the proxy to its implementation (ERC-1967 slot).
  await testClient.setStorageAt({
    address: noxComputeAddress,
    index: ERC1967_IMPLEMENTATION_SLOT,
    value: pad(NOX_COMPUTE_IMPL_ADDRESS, { size: 32 }),
  });

  await walletClient.sendTransaction({
    account: targetDeployer,
    to: noxComputeAddress,
    data: encodeFunctionData({
      abi: impl.abi,
      functionName: "initialize",
      args: [
        targetDeployer,
        targetDeployer,
        NOX_KMS_PUBLIC_KEY,
        NOX_GATEWAY_ADDRESS,
      ],
    }),
  });
}
