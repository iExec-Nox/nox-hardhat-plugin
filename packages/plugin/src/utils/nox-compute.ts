import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import {
  type Abi,
  type Address,
  type Hex,
  type WalletClient,
  createWalletClient,
  encodeFunctionData,
  http,
} from "viem";
import {
  NOX_COMPUTE_CONTRACT_NAME,
  NOX_GATEWAY_ADDRESS,
  NOX_KMS_PUBLIC_KEY,
} from "../config.js";
import { loadCompiledContract } from "./artifacts.js";
import { noxComputeAddressForChain } from "./chain.js";

/**
 * Install NoxCompute on the target node:
 *   1. `hardhat_setCode` injects the compiled runtime bytecode at the
 *      chain-specific NoxCompute address (resolved via `eth_chainId` so it
 *      matches `noxComputeContract()` in the Nox SDK).
 *   2. The storage is bootstrapped (owner / kmsPublicKey / gateway) so the
 *      offchain services can read a coherent on-chain state.
 */
export async function deployNoxCompute(
  hre: HardhatRuntimeEnvironment,
  rpcUrl: string,
): Promise<void> {
  const client = createWalletClient({ transport: http(rpcUrl) });

  const chainIdHex: Hex = await client.request({
    method: "eth_chainId" as never,
  });
  const chainId = Number.parseInt(chainIdHex, 16);
  const noxComputeAddress = noxComputeAddressForChain(chainId);

  const { abi, deployedBytecode } = await loadCompiledContract(
    hre,
    NOX_COMPUTE_CONTRACT_NAME,
  );

  await client.request({
    method: "hardhat_setCode" as never,
    params: [noxComputeAddress, deployedBytecode] as never,
  });
  console.log(
    `[nox] Injected ${NOX_COMPUTE_CONTRACT_NAME} bytecode at ${noxComputeAddress} (chainId=${chainId}).`,
  );

  const accounts: Address[] = await client.request({
    method: "eth_accounts" as never,
  });
  const deployer = accounts[0];
  if (deployer === undefined)
    throw new Error("[nox] Could not find a signer on the target node.");

  await callAsOwner(client, abi, deployer, noxComputeAddress, "initialize", [
    deployer,
    NOX_KMS_PUBLIC_KEY,
  ]);
  console.log(`[nox] NoxCompute initialized (owner=${deployer}).`);

  await callAsOwner(client, abi, deployer, noxComputeAddress, "setGateway", [
    NOX_GATEWAY_ADDRESS,
  ]);
  console.log(`[nox] NoxCompute gateway set to ${NOX_GATEWAY_ADDRESS}.`);
}

async function callAsOwner(
  client: WalletClient,
  abi: Abi,
  from: Address,
  to: Address,
  functionName: string,
  args: readonly unknown[],
): Promise<void> {
  await client.request({
    method: "eth_sendTransaction" as never,
    params: [
      {
        from,
        to,
        data: encodeFunctionData({ abi, functionName, args }),
      },
    ] as never,
  });
}
