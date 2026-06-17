import net from "node:net";

/**
 * Resolve to `true` if `port` can be bound on `host`, `false` if it is already
 * in use. Best-effort pre-flight check: there is an inherent race between this
 * probe and whoever binds the port next, but it is enough to surface a clear
 * error or pick another port before Docker / Hardhat try (and fail) to bind.
 */
export function isPortAvailable(
  port: number,
  host = "0.0.0.0",
): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        tester.close(() => resolve(true));
      });
    tester.listen(port, host);
  });
}

/** Ask the OS for an unused port by binding to port 0. */
function getRandomFreePort(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();
    tester.once("error", reject);
    tester.listen(0, host, () => {
      const address = tester.address();
      const port =
        typeof address === "object" && address !== null ? address.port : 0;
      tester.close(() => resolve(port));
    });
  });
}

/**
 * Return `preferred` when it is free, otherwise an OS-assigned free port.
 */
export async function resolveAvailablePort(
  preferred: number,
  host = "0.0.0.0",
): Promise<number> {
  if (await isPortAvailable(preferred, host)) {
    return preferred;
  }
  return getRandomFreePort(host);
}
