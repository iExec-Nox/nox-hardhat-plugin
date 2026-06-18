import net from "node:net";

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

/**
 * Ask the kernel for an available port by binding to port 0: the OS then picks
 * a free ephemeral port for us, which we read back before closing the probe
 * server to release it.
 *
 * This is inherently best-effort: between releasing the port here and
 * Docker actually binding it, there is a tiny window in which another process
 * could theoretically grab it. In practice this is negligible.
 */
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
