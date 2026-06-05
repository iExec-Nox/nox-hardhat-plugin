import {
  createTestClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  http,
  pad,
} from "viem";
import {
  ERC1967_IMPLEMENTATION_SLOT,
  ERC1967_PROXY_ARTIFACT_PATH,
  NOX_COMPUTE_ARTIFACT_PATH,
  NOX_COMPUTE_IMPL_ADDRESS,
  NOX_GATEWAY_ADDRESS,
  NOX_KMS_PUBLIC_KEY,
  type NoxChain,
} from "../nox-config.js";
import { loadDeploymentArtifact } from "./artifacts.js";

/**
 * Install NoxCompute on the target node by mirroring the production deployment
 * of the given `chain`:
 *   1. `setCode` injects the ERC1967Proxy runtime at the chain's canonical
 *      `noxComputeProxyAddress` and the NoxCompute implementation runtime at
 *      a side address.
 *   2. `setStorageAt` writes the implementation address into the proxy's
 *      ERC-1967 slot (normally done by the proxy's constructor, which we
 *      bypass when etching bytecode directly).
 *   3. `initialize(admin, upgrader, kmsPublicKey, gateway)` is called on the
 *      proxy — it delegates to the implementation, sets all config in the
 *      proxy's storage AND emits the zero-handle seed events that the
 *      offchain stack needs to recognize implicit zero handles.
 *
 * Unlike recompiling NoxCompute.sol from source, this uses the exact runtime
 * that's deployed on chain and that the KMS/ingestor were validated against.
 */
export async function deployNoxCompute(
  rpcUrl: string,
  chain: NoxChain,
): Promise<void> {
  const [impl, proxy] = await Promise.all([
    loadDeploymentArtifact(NOX_COMPUTE_ARTIFACT_PATH),
    loadDeploymentArtifact(ERC1967_PROXY_ARTIFACT_PATH),
  ]);

  const viemChain = defineChain({
    id: chain.chainId,
    name: `nox-local-${chain.chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [] } },
  });

  const transport = http(rpcUrl);
  const testClient = createTestClient({
    mode: "hardhat",
    chain: viemChain,
    transport,
  });
  const walletClient = createWalletClient({ chain: viemChain, transport });

  await testClient.setCode({
    address: NOX_COMPUTE_IMPL_ADDRESS,
    bytecode: impl.deployedBytecode,
  });
  await testClient.setCode({
    address: chain.noxComputeProxyAddress,
    bytecode: proxy.deployedBytecode,
  });
  console.log(
    `[nox] Etched NoxCompute impl at ${NOX_COMPUTE_IMPL_ADDRESS} and proxy at ${chain.noxComputeProxyAddress}.`,
  );

  // Wire the proxy to its implementation (ERC-1967 slot).
  await testClient.setStorageAt({
    address: chain.noxComputeProxyAddress,
    index: ERC1967_IMPLEMENTATION_SLOT,
    value: pad(NOX_COMPUTE_IMPL_ADDRESS, { size: 32 }),
  });

  const [deployer] = await walletClient.getAddresses();
  if (deployer === undefined)
    throw new Error("[nox] Could not find a signer on the target node.");

  // initialize(admin, upgrader, kmsPublicKey, gateway)
  await walletClient.sendTransaction({
    account: deployer,
    to: chain.noxComputeProxyAddress,
    data: encodeFunctionData({
      abi: impl.abi,
      functionName: "initialize",
      args: [deployer, deployer, NOX_KMS_PUBLIC_KEY, NOX_GATEWAY_ADDRESS],
    }),
  });
  console.log(
    `[nox] NoxCompute initialized (chainId=${chain.chainId}, admin=${deployer}, gateway=${NOX_GATEWAY_ADDRESS}).`,
  );
}
