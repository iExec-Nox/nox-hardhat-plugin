import {
  createTestClient,
  createWalletClient,
  encodeFunctionData,
  http,
  pad,
} from "viem";
import { hardhat } from "viem/chains";
import {
  ERC1967_IMPLEMENTATION_SLOT,
  ERC1967_PROXY_ARTIFACT_PATH,
  NOX_COMPUTE_ADDRESS,
  NOX_COMPUTE_ARTIFACT_PATH,
  NOX_COMPUTE_IMPL_ADDRESS,
  NOX_GATEWAY_ADDRESS,
  NOX_KMS_PUBLIC_KEY,
} from "../nox-config.js";
import { loadDeploymentArtifact } from "./artifacts.js";

/**
 * Install NoxCompute on the target Hardhat node (chainId 31337):
 *   1. `setCode` injects the ERC1967Proxy runtime at the canonical address
 *      and the NoxCompute implementation runtime at a side address.
 *   2. `setStorageAt` writes the implementation address into the proxy's
 *      ERC-1967 slot (normally done by the proxy's constructor, which we
 *      bypass when etching bytecode directly).
 *   3. `initialize(admin, upgrader, kmsPublicKey, gateway)` is called on the
 *      proxy — it sets all config in the proxy's storage AND emits the
 *      zero-handle seed events that the offchain stack needs.
 */
export async function deployNoxCompute(rpcUrl: string): Promise<void> {
  const [impl, proxy] = await Promise.all([
    loadDeploymentArtifact(NOX_COMPUTE_ARTIFACT_PATH),
    loadDeploymentArtifact(ERC1967_PROXY_ARTIFACT_PATH),
  ]);

  const transport = http(rpcUrl);
  const testClient = createTestClient({
    mode: "hardhat",
    chain: hardhat,
    transport,
  });
  const walletClient = createWalletClient({ chain: hardhat, transport });

  await testClient.setCode({
    address: NOX_COMPUTE_IMPL_ADDRESS,
    bytecode: impl.deployedBytecode,
  });
  await testClient.setCode({
    address: NOX_COMPUTE_ADDRESS,
    bytecode: proxy.deployedBytecode,
  });
  console.log(
    `[nox] Etched NoxCompute impl at ${NOX_COMPUTE_IMPL_ADDRESS} and proxy at ${NOX_COMPUTE_ADDRESS}.`,
  );

  // Wire the proxy to its implementation (ERC-1967 slot).
  await testClient.setStorageAt({
    address: NOX_COMPUTE_ADDRESS,
    index: ERC1967_IMPLEMENTATION_SLOT,
    value: pad(NOX_COMPUTE_IMPL_ADDRESS, { size: 32 }),
  });

  const [deployer] = await walletClient.getAddresses();
  if (deployer === undefined)
    throw new Error("[nox] Could not find a signer on the target node.");

  await walletClient.sendTransaction({
    account: deployer,
    to: NOX_COMPUTE_ADDRESS,
    data: encodeFunctionData({
      abi: impl.abi,
      functionName: "initialize",
      args: [deployer, deployer, NOX_KMS_PUBLIC_KEY, NOX_GATEWAY_ADDRESS],
    }),
  });
  console.log(
    `[nox] NoxCompute initialized (admin=${deployer}, gateway=${NOX_GATEWAY_ADDRESS}).`,
  );
}
