import type { NetworkHooks, HookContext } from "hardhat/types/hooks";
import type { ChainType, NetworkConnection } from "hardhat/types/network";
import { NoxRuntime } from "../runtime/NoxRuntime.js";

export default async (): Promise<Partial<NetworkHooks>> => {
  const runtimes = new WeakMap<
    NetworkConnection<ChainType | string>,
    NoxRuntime
  >();

  return {
    async newConnection<ChainTypeT extends ChainType | string>(
      context: HookContext,
      next: (ctx: HookContext) => Promise<NetworkConnection<ChainTypeT>>,
    ): Promise<NetworkConnection<ChainTypeT>> {
      const connection = await next(context);

      if (context.config.nox?.enabled === false) {
        return connection;
      }

      const runtime = new NoxRuntime(context.config.nox, connection.provider);
      await runtime.start();
      connection.nox = runtime;
      runtimes.set(connection, runtime);

      return connection;
    },

    async closeConnection<ChainTypeT extends ChainType | string>(
      context: HookContext,
      connection: NetworkConnection<ChainTypeT>,
      next: (
        ctx: HookContext,
        conn: NetworkConnection<ChainTypeT>,
      ) => Promise<void>,
    ): Promise<void> {
      await next(context, connection);
      const runtime = runtimes.get(connection);
      if (runtime !== undefined) {
        await runtime.stop();
        runtimes.delete(connection);
      }
    },
  };
};
