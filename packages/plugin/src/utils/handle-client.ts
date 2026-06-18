// Type-only augmentation imports: they register the `viem` / `ethers` fields on
// `NetworkConnection` for type-checking but emit no runtime `require`, so a
// project that installs only one toolbox doesn't crash when loading the plugin.
import type {} from "@nomicfoundation/hardhat-ethers";
import type {} from "@nomicfoundation/hardhat-toolbox-viem";
import {
  createEthersHandleClient,
  createViemHandleClient,
} from "@iexec-nox/handle";
import type { HandleClient, HandleClientConfig } from "@iexec-nox/handle";
import type { NetworkConnection } from "hardhat/types/network";

/**
 * The `@iexec-nox/handle` client factories, injectable so the toolbox detection
 * can be unit-tested without a real chain.
 */
export interface HandleClientFactories {
  viem: typeof createViemHandleClient;
  ethers: typeof createEthersHandleClient;
}

const defaultFactories: HandleClientFactories = {
  viem: createViemHandleClient,
  ethers: createEthersHandleClient,
};

/**
 * Build a handle client from whichever Hardhat toolbox the project enables:
 * `@nomicfoundation/hardhat-toolbox-viem` (`connection.viem`) or
 * `@nomicfoundation/hardhat-ethers` (`connection.ethers`). The client is bound
 * to the connection's first signer so user-decryption ACLs line up with the
 * account the tests act as.
 */
export async function createHandleClient(
  connection: NetworkConnection<"op">,
  config: Partial<HandleClientConfig>,
  factories: HandleClientFactories = defaultFactories,
): Promise<HandleClient> {
  // The augmentations type `viem`/`ethers` as always-present; at runtime only
  // the enabled toolbox populates one of them, so probe via an optional view.
  if ((connection as { viem?: unknown }).viem != null) {
    const [walletClient] = await connection.viem.getWalletClients();
    return factories.viem(walletClient, config);
  }

  if ((connection as { ethers?: unknown }).ethers != null) {
    const [signer] = await connection.ethers.getSigners();
    return factories.ethers(signer, config);
  }

  throw new Error(
    "[nox] No supported Hardhat toolbox found on the network connection. " +
      "Enable `@nomicfoundation/hardhat-toolbox-viem` or " +
      "`@nomicfoundation/hardhat-ethers` in your Hardhat config.",
  );
}
