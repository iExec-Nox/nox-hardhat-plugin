import {
  type Abi,
  type Address,
  type WalletClient,
  createWalletClient,
  encodeFunctionData,
  http,
  pad,
} from "viem";
import {
  ERC1967_IMPLEMENTATION_SLOT,
  ERC1967_PROXY_ARTIFACT_PATH,
  NOX_COMPUTE_ARTIFACT_PATH,
  NOX_COMPUTE_IMPL_ADDRESS,
  NOX_COMPUTE_PROXY_ADDRESS,
  NOX_GATEWAY_ADDRESS,
  NOX_KMS_PUBLIC_KEY,
} from "../nox-config.js";
import { loadDeploymentArtifact } from "./artifacts.js";

/**
 * Install NoxCompute on the target node by mirroring the production Arbitrum
 * Sepolia deployment:
 *   1. `hardhat_setCode` injects the ERC1967Proxy runtime at the well-known
 *      proxy address and the NoxCompute implementation runtime at the impl
 *      address.
 *   2. `hardhat_setStorageAt` writes the implementation address into the
 *      proxy's ERC-1967 slot (normally done by the proxy's constructor,
 *      which we bypass when etching bytecode directly).
 *   3. `initialize(admin, upgrader, kmsPublicKey, gateway)` is called on the
 *      proxy — it delegates to the implementation, sets all config in the
 *      proxy's storage AND emits the zero-handle seed events that the
 *      offchain stack needs to recognize implicit zero handles.
 *
 * Unlike recompiling NoxCompute.sol from source, this uses the exact runtime
 * that's deployed on chain and that the KMS/ingestor were validated against.
 */
export async function deployNoxCompute(rpcUrl: string): Promise<void> {
  const [impl, proxy] = await Promise.all([
    loadDeploymentArtifact(NOX_COMPUTE_ARTIFACT_PATH),
    loadDeploymentArtifact(ERC1967_PROXY_ARTIFACT_PATH),
  ]);

  const client = createWalletClient({ transport: http(rpcUrl) });

  await client.request({
    method: "hardhat_setCode" as never,
    params: [NOX_COMPUTE_IMPL_ADDRESS, impl.deployedBytecode] as never,
  });
  await client.request({
    method: "hardhat_setCode" as never,
    params: [NOX_COMPUTE_PROXY_ADDRESS, proxy.deployedBytecode] as never,
  });
  console.log(
    `[nox] Etched NoxCompute impl at ${NOX_COMPUTE_IMPL_ADDRESS} and proxy at ${NOX_COMPUTE_PROXY_ADDRESS}.`,
  );

  // Wire the proxy to its implementation (ERC-1967 slot).
  await client.request({
    method: "hardhat_setStorageAt" as never,
    params: [
      NOX_COMPUTE_PROXY_ADDRESS,
      ERC1967_IMPLEMENTATION_SLOT,
      pad(NOX_COMPUTE_IMPL_ADDRESS, { size: 32 }),
    ] as never,
  });

  const accounts: Address[] = await client.request({
    method: "eth_accounts" as never,
  });
  const deployer = accounts[0];
  if (deployer === undefined)
    throw new Error("[nox] Could not find a signer on the target node.");

  // initialize(admin, upgrader, kmsPublicKey, gateway)
  await callAsOwner(client, impl.abi, deployer, "initialize", [
    deployer,
    deployer,
    NOX_KMS_PUBLIC_KEY,
    NOX_GATEWAY_ADDRESS,
  ]);
  console.log(
    `[nox] NoxCompute initialized (admin=${deployer}, gateway=${NOX_GATEWAY_ADDRESS}).`,
  );
}

async function callAsOwner(
  client: WalletClient,
  abi: Abi,
  from: Address,
  functionName: string,
  args: readonly unknown[],
): Promise<void> {
  await client.request({
    method: "eth_sendTransaction" as never,
    params: [
      {
        from,
        to: NOX_COMPUTE_PROXY_ADDRESS,
        data: encodeFunctionData({ abi, functionName, args }),
      },
    ] as never,
  });
}
