/**
 * Extracts the port from a URL. Throws if the URL omits an explicit port —
 * the local Nox stack always runs on a developer-chosen port, defaulting to
 * 80/443 would silently mis-bind the JSON-RPC server.
 */
export function portFromUrl(url: string): number {
  const port = new URL(url).port;
  if (port === "")
    throw new Error(
      `[nox] Network url '${url}' must include an explicit port (e.g. ':8545').`,
    );
  return Number(port);
}
