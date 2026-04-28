import net, { Socket } from "net";

const port = Number(process.argv[2] || 9000);
const server = net.createServer();

function sendJson(socket: Socket, data: object): void {
  const payload = JSON.stringify(data) + "\r";
  socket.write(payload);
}

server.on("connection", (socket: Socket) => {
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 10_000);

  let buffer = Buffer.alloc(0);

  socket.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      const delimiterIndex = buffer.indexOf("\r");
      if (delimiterIndex === -1) break;

      const packet = buffer.subarray(0, delimiterIndex);
      buffer = buffer.subarray(delimiterIndex + 1);

      let message: { cmd: string; data?: unknown; ms?: number };
      try {
        message = JSON.parse(packet.toString());
      } catch {
        sendJson(socket, { ok: false, error: "invalid json" });
        return;
      }

      const command = message.cmd;
      switch (command) {
        case "echo":
          sendJson(socket, { ok: true, echo: message.data ?? null });
          break;

        case "delay": {
          const delayMs = Number(message.ms ?? 2000);
          setTimeout(
            () => sendJson(socket, { ok: true, delayed: delayMs }),
            delayMs,
          );
          break;
        }

        case "hang":
          // No response, client should timeout
          break;

        case "drop":
          socket.destroy(new Error("server dropped connection"));
          break;

        case "malformed":
          socket.write("THIS_IS_NOT_JSON\r");
          break;

        case "close-after-send":
          sendJson(socket, { ok: true, bye: true });
          socket.end();
          break;

        default:
          sendJson(socket, { ok: false, error: "unknown command" });
          break;
      }
    }
  });

  socket.on("error", (err: Error) => {
    console.log("[server] socket error:", err.message);
  });

  socket.on("close", () => {
    // Connection closed
  });
});

server.listen(port, () => {
  console.log(`TCP test server listening on port ${port}`);
});
