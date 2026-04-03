import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

/**
 * Minimal HTTP JSON-RPC server that proxies requests to an EIP-1193 provider.
 *
 * Hardhat 3 runs its network in-process. External Nox binaries (KMS, Gateway,
 * Ingestor, Runner) need a standard HTTP JSON-RPC endpoint to read chain state
 * and submit transactions. This server bridges the two.
 */
export class JsonRpcServer {
  private server: Server | null = null;

  constructor(
    private readonly provider: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
    },
    private readonly port: number,
    private readonly host = "127.0.0.1",
  ) {}

  /** Returns the port the server is bound to. Only valid after start(). */
  getPort(): number {
    const addr = this.server?.address();
    if (addr === null || addr === undefined || typeof addr === "string") {
      throw new Error("Server not started");
    }
    return addr.port;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer(
        (req: IncomingMessage, res: ServerResponse) =>
          void this.handle(req, res),
      );
      this.server.once("error", reject);
      this.server.listen(this.port, this.host, () => resolve());
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server === null) {
        resolve();
        return;
      }
      this.server.close(() => resolve());
      this.server = null;
    });
  }

  private async handle(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }

    let body: { id: unknown; method: string; params?: unknown[] };
    try {
      body = await readJson(req);
    } catch {
      res.writeHead(400).end();
      return;
    }

    res.setHeader("Content-Type", "application/json");

    try {
      const result = await this.provider.request({
        method: body.method,
        params: body.params ?? [],
      });
      res
        .writeHead(200)
        .end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const code = (err as any)?.code ?? -32603;
      res.writeHead(200).end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          error: { code, message },
        }),
      );
    }
  }
}

function readJson(
  req: IncomingMessage,
): Promise<{ id: unknown; method: string; params?: unknown[] }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(
          JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
            id: unknown;
            method: string;
            params?: unknown[];
          },
        );
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
    req.on("error", reject);
  });
}
