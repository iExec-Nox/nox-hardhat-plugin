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
 *   3. `initialize` and `setGateway` are called on the proxy — they delegate
 *      to the implementation and set owner / kmsPublicKey / gateway in the
 *      proxy's storage, just like in production.
 *
 * Unlike recompiling NoxCompute.sol from source, this uses the exact runtime
 * that's deployed on chain and that the KMS/ingestor were validated against.
 */
export async function deployNoxCompute(rpcUrl: string): Promise<void> {
  const [impl, proxy] = await Promise.all([
    loadDeploymentArtifact("NoxCompute#implementation.json"),
    loadDeploymentArtifact("NoxCompute#proxy.json"),
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

  // Calls below hit the proxy address; the proxy delegatecalls to the impl,
  // so storage writes land in the proxy's storage — matching production.
  await callAsOwner(client, impl.abi, deployer, "initialize", [
    deployer,
    NOX_KMS_PUBLIC_KEY,
  ]);
  console.log(`[nox] NoxCompute initialized (owner=${deployer}).`);

  await callAsOwner(client, impl.abi, deployer, "setGateway", [
    NOX_GATEWAY_ADDRESS,
  ]);
  console.log(`[nox] NoxCompute gateway set to ${NOX_GATEWAY_ADDRESS}.`);
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
