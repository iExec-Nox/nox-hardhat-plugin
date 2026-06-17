import assert from "node:assert/strict";
import net from "node:net";
import { after, before, describe, it } from "node:test";
import { isPortAvailable, resolveAvailablePort } from "../src/utils/net.js";

describe("net port helpers", () => {
  let occupied: net.Server;
  let busyPort: number;

  before(async () => {
    occupied = net.createServer();
    busyPort = await new Promise<number>((resolve) => {
      occupied.listen(0, "0.0.0.0", () => {
        const address = occupied.address();
        resolve(typeof address === "object" && address ? address.port : 0);
      });
    });
  });

  after(() => {
    occupied.close();
  });

  it("isPortAvailable returns false for a port in use", async () => {
    assert.equal(await isPortAvailable(busyPort), false);
  });

  it("resolveAvailablePort falls back to a free port when preferred is taken", async () => {
    const port = await resolveAvailablePort(busyPort);
    assert.notEqual(port, busyPort);
    assert.equal(await isPortAvailable(port), true);
  });

  it("resolveAvailablePort keeps the preferred port when it is free", async () => {
    // Discover a currently-free port, then confirm it is kept as-is.
    const free = await new Promise<number>((resolve) => {
      const probe = net.createServer();
      probe.listen(0, "0.0.0.0", () => {
        const address = probe.address();
        const port = typeof address === "object" && address ? address.port : 0;
        probe.close(() => resolve(port));
      });
    });
    assert.equal(await resolveAvailablePort(free), free);
  });
});
