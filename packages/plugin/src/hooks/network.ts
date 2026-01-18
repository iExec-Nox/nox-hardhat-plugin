import type { HookContext, NetworkHooks } from "hardhat/types/hooks";
import { ChainType, NetworkConnection } from "hardhat/types/network";
import { CORE_CONTRACT_ADDRESS } from "../config.js";
import { installCoreContract } from "../core.js";

export default async (): Promise<Partial<NetworkHooks>> => {
  const handlers: Partial<NetworkHooks> = {
    async newConnection<ChainTypeT extends ChainType | string>(
      context: HookContext,
      next: (
        nextContext: HookContext,
      ) => Promise<NetworkConnection<ChainTypeT>>,
    ): Promise<NetworkConnection<ChainTypeT>> {
      const connection = await next(context);
      const { coreMock } = context.config;

      // Auto-install on any network if enabled (since we're using hardhat_setCode)
      if (coreMock.enabled) {
        await installCoreContract(connection.provider, CORE_CONTRACT_ADDRESS, {
          force: false,
          quiet: true,
        });
      }

      return connection;
    },
    async onRequest(context, networkConnection, jsonRpcRequest, next) {
      return next(context, networkConnection, jsonRpcRequest);
    },
  };

  return handlers;
};
