const dev = process.argv.includes("--dev");
process.env.NODE_ENV ??= dev ? "development" : "production";

async function main() {
  const { createServer } = await import("node:http");
  const { parse } = await import("node:url");
  const next = (await import("next")).default;
  const { WebSocketServer } = await import("ws");
  const { handleConnection } = await import("./server/rooms");
  const { pipePreview } = await import("./server/preview");

  const port = Number(process.env.PORT) || 3000;
  const hostname = "0.0.0.0";
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();
  const upgrade = app.getUpgradeHandler();

  const server = createServer((req, res) => {
    const parsed = parse(req.url || "", true);
    if (parsed.pathname === "/api/preview") {
      const token = Array.isArray(parsed.query.token) ? parsed.query.token[0] : parsed.query.token;
      if (!token) {
        res.statusCode = 400;
        res.end();
        return;
      }
      pipePreview(req, res, token).catch(() => {
        if (!res.headersSent) res.statusCode = 502;
        if (!res.writableEnded) res.end();
      });
      return;
    }
    void handle(req, res, parsed);
  });

  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", (socket) => handleConnection(socket));

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "", true);
    if (pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
      return;
    }
    void upgrade(req, socket, head).catch(() => socket.destroy());
  });

  setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === 1) client.ping();
    }
  }, 20_000);

  server.listen(port, hostname, () => {
    console.log(`Ready on http://${hostname}:${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
