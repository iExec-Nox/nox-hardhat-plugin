import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { downAll, logs as composeLogs, upAll } from "docker-compose";
import { ALL_SERVICES, COMPOSE_OPTS, HANDLE_GATEWAY_URL } from "../nox-config.js";

/**
 * Returns the Docker host URL from the active Docker context so the
 * `docker-compose` npm module (which spawns `docker compose` as a child
 * process) uses the same socket as the `docker` CLI.
 *
 * Without this, macOS users with multiple Docker runtimes (OrbStack,
 * Docker Desktop, Colima) can hit "cannot connect to Docker daemon" errors
 * because the child process picks up a stale or wrong context socket from
 * ~/.docker/config.json while the `docker` CLI resolves correctly through
 * /var/run/docker.sock or DOCKER_HOST.
 */
function resolveDockerHost(): string | undefined {
  if (process.env.DOCKER_HOST) return process.env.DOCKER_HOST;
  try {
    return (
      execFileSync(
        "docker",
        ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
        { encoding: "utf-8", timeout: 5_000 },
      ).trim() || undefined
    );
  } catch {
    return undefined;
  }
}

function buildComposeOpts() {
  const dockerHost = resolveDockerHost();
  return dockerHost
    ? {
        ...COMPOSE_OPTS,
        env: { ...process.env, DOCKER_HOST: dockerHost } as NodeJS.ProcessEnv,
      }
    : COMPOSE_OPTS;
}

/** Bring the offchain stack up and wait for every service to be healthy. */
export async function startOffchainServices(): Promise<void> {
  console.log("[nox] Starting offchain services...");
  const opts = buildComposeOpts();
  // Purge any stale containers and volumes from a previous interrupted run
  // before bringing the stack up. Without this, the ingestor may resume from
  // a persisted block height and miss events emitted by the fresh Hardhat node,
  // causing handle resolution to silently fail for the whole test run.
  await downAll({ ...opts, commandOptions: ["--volumes", "--remove-orphans"] }).catch(
    () => {},
  );
  await upAll({ ...opts, commandOptions: ["--wait", "--remove-orphans"] });
  // Verify the handle gateway is actually serving the Nox API. On macOS,
  // Docker port bindings (especially under OrbStack) can coexist with a host
  // process already listening on the same port, so a different service may be
  // reachable even after a successful `docker compose up`.
  await verifyGateway();
}

/** Tear the offchain stack down. */
export async function stopOffchainServices(): Promise<void> {
  const opts = buildComposeOpts();
  await downAll({ ...opts, commandOptions: ["--volumes", "--remove-orphans"] });
}

/**
 * Confirm that the handle gateway at HANDLE_GATEWAY_URL is the real Nox
 * gateway by calling a Nox-specific endpoint and checking the response
 * Content-Type. A plain HTML response indicates a different service (e.g. a
 * Next.js dev server) is on the same port.
 */
async function verifyGateway(): Promise<void> {
  const url = `${HANDLE_GATEWAY_URL}/v0/public/handles/status`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handles: [] }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    throw new Error(
      `[nox] Handle gateway at ${HANDLE_GATEWAY_URL} is unreachable after startup: ${err}`,
    );
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("application/json")) {
    throw new Error(
      `[nox] Port 3000 appears to be occupied by a non-Nox service ` +
        `(expected application/json, got "${contentType}" with HTTP ${res.status}). ` +
        `Free port 3000 before running tests.`,
    );
  }
}

/**
 * Dump logs of every offchain service to `offchain-services.log` (cwd of the
 * Hardhat process), intended for failure diagnostics. Stdout stays mostly
 * clean so the Hardhat test report remains readable, while the full trace is
 * available on disk.
 */
export async function dumpOffchainServicesLogs(): Promise<void> {
  const opts = buildComposeOpts();
  const result = await composeLogs(ALL_SERVICES, {
    ...opts,
    log: false,
    commandOptions: ["--no-color", "--timestamps"],
  });
  const logPath = path.resolve(process.cwd(), "offchain-services.log");
  await writeFile(logPath, result.out + result.err, "utf-8");
  console.log(`[nox] Offchain services logs written to ${logPath}`);
}
