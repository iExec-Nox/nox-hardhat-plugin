export async function waitForHealthy(
  url: string,
  timeoutMs: number,
  intervalMs = 500,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetchFn(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timeout waiting for ${url} to become healthy`);
}
