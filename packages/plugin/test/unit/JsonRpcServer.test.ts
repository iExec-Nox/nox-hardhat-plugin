import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";

import { JsonRpcServer } from "../../src/runtime/JsonRpcServer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function post(
  port: number,
  body: unknown,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`http://127.0.0.1:${port}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = res.ok || res.status === 200 ? await res.json() : null;
  return { status: res.status, json };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("JsonRpcServer", () => {
  describe("method routing", () => {
    let server: JsonRpcServer;
    let port: number;

    before(async () => {
      server = new JsonRpcServer(
        {
          request: async ({ method }: { method: string }) => `result:${method}`,
        },
        0, // OS assigns a free port
      );
      await server.start();
      port = server.getPort();
    });

    after(async () => {
      await server.stop();
    });

    it("GET returns 405", async () => {
      const res = await fetch(`http://127.0.0.1:${port}`);
      assert.equal(res.status, 405);
    });

    it("POST with malformed JSON returns 400", async () => {
      const res = await fetch(`http://127.0.0.1:${port}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json{{{",
      });
      assert.equal(res.status, 400);
    });

    it("proxies POST to the provider and returns a JSON-RPC result", async () => {
      const { status, json } = await post(port, {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      });
      assert.equal(status, 200);
      assert.deepEqual(json, {
        jsonrpc: "2.0",
        id: 1,
        result: "result:eth_chainId",
      });
    });

    it("forwards the request id from the client", async () => {
      const { json } = await post(port, {
        jsonrpc: "2.0",
        id: 42,
        method: "eth_blockNumber",
      });
      assert.equal((json as Record<string, unknown>)["id"], 42);
    });

    it("works with a null id (notification-style)", async () => {
      const { status } = await post(port, {
        jsonrpc: "2.0",
        id: null,
        method: "eth_syncing",
      });
      assert.equal(status, 200);
    });
  });

  describe("provider error handling", () => {
    it("returns a JSON-RPC error when the provider throws with a code", async () => {
      const provider = {
        request: async () => {
          const err = new Error("revert") as Error & { code: number };
          err.code = -32000;
          throw err;
        },
      };
      const server = new JsonRpcServer(provider, 0);
      await server.start();
      const port = server.getPort();

      try {
        const { status, json } = await post(port, {
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
        });
        assert.equal(status, 200);
        const error = (json as Record<string, unknown>)["error"] as Record<
          string,
          unknown
        >;
        assert.equal(error["code"], -32000);
        assert.equal(error["message"], "revert");
      } finally {
        await server.stop();
      }
    });

    it("defaults to error code -32603 when the provider error has no code", async () => {
      const provider = {
        request: async () => {
          throw new Error("internal");
        },
      };
      const server = new JsonRpcServer(provider, 0);
      await server.start();
      const port = server.getPort();

      try {
        const { json } = await post(port, {
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
        });
        const error = (json as Record<string, unknown>)["error"] as Record<
          string,
          unknown
        >;
        assert.equal(error["code"], -32603);
      } finally {
        await server.stop();
      }
    });

    it("handles non-Error throws by stringifying the message", async () => {
      const provider = {
        request: async () => {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw "string error";
        },
      };
      const server = new JsonRpcServer(provider, 0);
      await server.start();
      const port = server.getPort();

      try {
        const { json } = await post(port, {
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
        });
        const error = (json as Record<string, unknown>)["error"] as Record<
          string,
          unknown
        >;
        assert.equal(error["message"], "string error");
      } finally {
        await server.stop();
      }
    });
  });

  describe("lifecycle", () => {
    it("getPort() throws before start()", () => {
      const server = new JsonRpcServer({ request: async () => null }, 0);
      assert.throws(() => server.getPort(), /not started/);
    });

    it("stop() resolves cleanly when never started", async () => {
      const server = new JsonRpcServer({ request: async () => null }, 0);
      await assert.doesNotReject(() => server.stop());
    });

    it("handles multiple sequential requests correctly", async () => {
      let calls = 0;
      const provider = { request: async () => ++calls };
      const server = new JsonRpcServer(provider, 0);
      await server.start();
      const port = server.getPort();

      try {
        await post(port, { jsonrpc: "2.0", id: 1, method: "eth_blockNumber" });
        await post(port, { jsonrpc: "2.0", id: 2, method: "eth_blockNumber" });
        await post(port, { jsonrpc: "2.0", id: 3, method: "eth_blockNumber" });
        assert.equal(calls, 3);
      } finally {
        await server.stop();
      }
    });
  });
});
