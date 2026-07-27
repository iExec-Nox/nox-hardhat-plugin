import http from "node:http";
import type { EthereumProvider } from "hardhat/types/providers";
import type { JsonRpcServer } from "hardhat/types/network";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: unknown;
  method: string;
  params?: unknown[];
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

async function readRequestBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function toErrorResponse(id: unknown, error: unknown): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code: -32603,
      message: String(error),
      data: (error as { data?: unknown })?.data,
    },
  };
}

/**
 * Wraps an arbitrary `EthereumProvider` in a plain `node:http` JSON-RPC
 * server. `hre.network.createServer(...)` can't be reused for this: it
 * always spins up a brand-new EDR chain instance (`create()`), never reuses
 * the one already cached by `getOrCreate()` — see
 * `docs/plans/attach-rpc-to-existing-network.md`. `JsonRpcServerImplementation`
 * itself is Hardhat-internal and not importable, so the relay is hand-rolled
 * here, modeled on its own `JsonRpcHandler.handleHttp`.
 *
 * HTTP-only, no WebSocket/`eth_subscribe` support — nothing downstream of
 * this relay (offchain services, NoxCompute deployment/resolution) uses it.
 *
 * Error responses are a flat generic wrapper, not Hardhat's internal
 * `ProviderError`/revert-code classification (those helpers aren't
 * exported) — a minor behavior difference from `createServer`.
 */
export function createJsonRpcRelay(
  provider: EthereumProvider,
  hostname: string,
  port: number,
): JsonRpcServer {
  const httpServer = http.createServer((req, res) => {
    void (async () => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "OPTIONS, POST");
      res.setHeader("Access-Control-Allow-Headers", "*");

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      const handleOne = async (
        rpcReq: JsonRpcRequest,
      ): Promise<JsonRpcResponse> => {
        try {
          const result = await provider.request({
            method: rpcReq.method,
            params: rpcReq.params,
          });
          return { jsonrpc: "2.0", id: rpcReq.id ?? null, result };
        } catch (error) {
          return toErrorResponse(rpcReq.id, error);
        }
      };

      let body: JsonRpcRequest | JsonRpcRequest[];
      try {
        body = JSON.parse(await readRequestBody(req)) as
          | JsonRpcRequest
          | JsonRpcRequest[];
      } catch (error) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(toErrorResponse(null, error)));
        return;
      }

      const response = Array.isArray(body)
        ? await Promise.all(body.map(handleOne))
        : await handleOne(body);

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(response));
    })();
  });

  return {
    listen(): Promise<{ address: string; port: number }> {
      return new Promise((resolve) => {
        httpServer.listen(port, hostname, () => {
          const address = httpServer.address();
          if (address === null || typeof address === "string") {
            throw new Error(
              `[nox] Expected a TCP address from the JSON-RPC relay, got: ${String(address)}`,
            );
          }
          resolve(address);
        });
      });
    },
    close(): Promise<void> {
      return new Promise((resolve, reject) => {
        httpServer.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    },
    afterClosed(): Promise<void> {
      return new Promise((resolve) => {
        httpServer.once("close", resolve);
      });
    },
  };
}
