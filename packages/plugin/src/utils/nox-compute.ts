import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import {
  type Abi,
  type Address,
  type WalletClient,
  createWalletClient,
  encodeFunctionData,
  http,
} from "viem";
import {
  NOX_COMPUTE_ADDRESS,
  NOX_COMPUTE_CONTRACT_NAME,
  NOX_GATEWAY_ADDRESS,
  NOX_KMS_PUBLIC_KEY,
} from "../nox-config.js";
import { loadCompiledContract } from "./artifacts.js";

/**
 * Install NoxCompute on the target node:
 *   1. `hardhat_setCode` injects the compiled runtime bytecode at the
 *      well-known NoxCompute address.
 *   2. The storage is bootstrapped (owner / kmsPublicKey / gateway) so the
 *      offchain services can read a coherent on-chain state.
 */
export async function deployNoxCompute(
  hre: HardhatRuntimeEnvironment,
  rpcUrl: string,
): Promise<void> {
  const client = createWalletClient({ transport: http(rpcUrl) });
  const { abi, deployedBytecode } = await loadCompiledContract(
    hre,
    NOX_COMPUTE_CONTRACT_NAME,
  );

  await client.request({
    method: "hardhat_setCode" as never,
    params: [NOX_COMPUTE_ADDRESS, deployedBytecode] as never,
  });
  console.log(
    `[nox] Injected ${NOX_COMPUTE_CONTRACT_NAME} bytecode at ${NOX_COMPUTE_ADDRESS}.`,
  );

  const accounts: Address[] = await client.request({
    method: "eth_accounts" as never,
  });
  const deployer = accounts[0];
  if (deployer === undefined)
    throw new Error("[nox] Could not find a signer on the target node.");

  await callAsOwner(client, abi, deployer, "initialize", [
    deployer,
    NOX_KMS_PUBLIC_KEY,
  ]);
  console.log(`[nox] NoxCompute initialized (owner=${deployer}).`);

  await callAsOwner(client, abi, deployer, "setGateway", [NOX_GATEWAY_ADDRESS]);
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
        to: NOX_COMPUTE_ADDRESS,
        data: encodeFunctionData({ abi, functionName, args }),
      },
    ] as never,
  });
}
