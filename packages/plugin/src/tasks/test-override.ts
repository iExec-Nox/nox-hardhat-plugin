import type { JsonRpcServer } from "hardhat/types/network";
import type { TaskOverrideActionFunction } from "hardhat/types/tasks";
import { deployNoxCompute } from "../utils/nox-compute.js";
import {
  dumpOffchainServicesLogs,
  startOffchainServices,
  stopOffchainServices,
} from "../utils/offchain-services.js";

// TODO: expose a user-config option (e.g. `myConfig.skipTestOverride?: boolean`)
// that makes this wrapper a no-op — i.e. just call `runSuper(args)` without
// booting the Nox stack or etching NoxCompute.
const testWrapperAction: TaskOverrideActionFunction = async (
  args,
  hre,
  runSuper,
) => {
  let server: JsonRpcServer | undefined;
  try {
    server = await hre.network.createServer(undefined, "0.0.0.0", 8545);
    const { address, port } = await server.listen();
    console.log(`[nox] Hardhat node listening on ${address}:${port}`);

    await deployNoxCompute(`http://127.0.0.1:${port}`);
    await startOffchainServices();

    await runSuper(args);
  } catch (err) {
    await dumpOffchainServicesLogs().catch(() => {
      /* best-effort diagnostic */
    });
    throw err;
  } finally {
    await stopOffchainServices().catch(() => {
      /* best-effort cleanup */
    });
    await server?.close().catch(() => {
      /* best-effort cleanup */
    });
  }
};

export default testWrapperAction;
