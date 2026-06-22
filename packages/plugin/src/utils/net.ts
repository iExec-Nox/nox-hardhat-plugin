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
