import type { Address } from "viem";
import { NOX_COMPUTE_ADDRESSES } from "../config.js";

/**
 * Resolves the NoxCompute address for a given chain id. Mirrors the lookup
 * performed by `noxComputeContract()` in `@iexec-nox/nox-protocol-contracts`'s
 * `Nox.sol`, so that contracts and the plugin agree on where NoxCompute lives.
 */
export function noxComputeAddressForChain(chainId: number): Address {
  const address = NOX_COMPUTE_ADDRESSES[chainId];
  if (address === undefined) {
    const supported = Object.keys(NOX_COMPUTE_ADDRESSES).join(", ");
    throw new Error(
      `[nox] Unsupported chain id ${chainId}. Supported chain ids: ${supported}.`,
    );
  }
  return address;
}
