import { execFileSync } from "node:child_process";
import type { JsonRpcServer } from "hardhat/types/network";
import type { TaskOverrideActionFunction } from "hardhat/types/tasks";
import { NOX_HOST_NETWORK, NOX_LOCAL_PORT } from "../config.js";
import { NOX_SUPPORTED_CHAIN_ID } from "../nox-config.js";
import { deployNoxCompute } from "../utils/nox-compute.js";
import {
  dumpOffchainServicesLogs,
  startOffchainServices,
  stopOffchainServices,
} from "../utils/offchain-services.js";

const testWrapperAction: TaskOverrideActionFunction = async (
  args,
  hre,
  runSuper,
) => {
  if (hre.config.nox.skipTestOverride) {
    console.log(
      "[nox] nox.skipTestOverride=true — running `hardhat test` without the Nox stack.",
    );
    await runSuper(args);
    return;
  }

  // The plugin's local stack only supports chainId 31337. For any other
  // network, log a warning and skip the setup — the user's tests then run
  // against the real endpoint and may fail if it lacks a Nox deployment.
  const targetNetworkName =
    hre.globalOptions.network !== undefined && hre.globalOptions.network !== ""
      ? hre.globalOptions.network
      : "default";
  const targetChainId = hre.config.networks[targetNetworkName]?.chainId;
  if (targetChainId !== NOX_SUPPORTED_CHAIN_ID) {
    console.warn(
      `[nox] Chain id ${targetChainId} (network='${targetNetworkName}') is not ` +
        `supported by the plugin's local stack (only ${NOX_SUPPORTED_CHAIN_ID} is). ` +
        `Skipping local stack setup.`,
    );
    await runSuper(args);
    return;
  }

  const { forceExitAfterTest } = hre.config.nox;

  let server: JsonRpcServer | undefined;
  // Watchdog timer reference — only used when forceExitAfterTest is true.
  // If the Hardhat node:test runner's pipeline() never resolves (open undici
  // keep-alive sockets prevent event-loop drain, see nodejs/node#51062), the
  // watchdog fires and force-exits cleanly after 5 minutes.
  let watchdog: NodeJS.Timeout | undefined;
  const forceExit = async (): Promise<never> => {
    clearTimeout(watchdog);
    await stopOffchainServices().catch(() => {});
    await server?.close().catch(() => {});
    const exitCode = process.exitCode ?? 0;
    await new Promise<void>((r) => process.stdout.write("", () => r()));
    await new Promise<void>((r) => process.stderr.write("", () => r()));
    process.exit(exitCode);
  };

  try {
    // Fail fast if Docker is not reachable so the error is clear and immediate
    // rather than appearing mid-setup after the Hardhat node has already started.
    try {
      execFileSync("docker", ["info"], { stdio: "ignore", timeout: 5_000 });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException | undefined)?.code;
      if (code === "ENOENT") {
        throw new Error(
          "[nox] Docker CLI (docker) was not found in PATH. " +
            "Install Docker (Docker Desktop, OrbStack, Colima, …) before running tests.",
        );
      }
      throw new Error(
        "[nox] Docker is not running or unreachable. " +
          "Start Docker (Docker Desktop, OrbStack, Colima, …) before running tests.",
      );
    }

    server = await hre.network.createServer(
      { network: NOX_HOST_NETWORK },
      "0.0.0.0",
      NOX_LOCAL_PORT,
    );
    const { address, port } = await server.listen();
    console.log(`[nox] Hardhat node listening on ${address}:${port}`);

    await deployNoxCompute(`http://127.0.0.1:${port}`);
    await startOffchainServices();

    if (forceExitAfterTest) {
      // Schedule the watchdog after the stack is up. 5 minutes gives ample
      // time for any test suite; the timer is unref'd so it never prevents a
      // normal exit on its own.
      watchdog = setTimeout(() => void forceExit(), 5 * 60_000);
      watchdog.unref();
    }

    // node:test resolves without throwing when tests fail, it sets
    // process.exitCode instead. Capture it before/after to detect
    // failures and dump logs for diagnostics.
    const exitCodeBefore = process.exitCode;
    await runSuper(args);
    if (process.exitCode !== 0 && process.exitCode !== exitCodeBefore) {
      await dumpOffchainServicesLogs().catch(() => {});
    }
  } catch (err) {
    clearTimeout(watchdog);
    await dumpOffchainServicesLogs().catch(() => {});
    throw err;
  } finally {
    clearTimeout(watchdog);
    await stopOffchainServices().catch(() => {});
    await server?.close().catch(() => {});
  }
  if (forceExitAfterTest) {
    await forceExit();
  }
};

export default testWrapperAction;
