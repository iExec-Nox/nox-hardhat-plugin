import assert from "node:assert/strict";
import net from "node:net";
import { after, before, describe, it } from "node:test";
import { isPortAvailable } from "../src/utils/net.js";

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

  it("isPortAvailable returns true for a free port", async () => {
    // Discover a currently-free port by binding to 0 and releasing it.
    const free = await new Promise<number>((resolve) => {
      const probe = net.createServer();
      probe.listen(0, "0.0.0.0", () => {
        const address = probe.address();
        const port = typeof address === "object" && address ? address.port : 0;
        probe.close(() => resolve(port));
      });
    });
    assert.equal(await isPortAvailable(free), true);
  });
});
