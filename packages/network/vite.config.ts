import { defineConfig } from "vite";
import type { Plugin, ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pino from "pino";
import type { IncomingMessage, ServerResponse } from "node:http";

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

const onCallPlugin = (): Plugin => {
  return {
    name: "on-call-plugin",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        "/on/call",
        (req: IncomingMessage, res: ServerResponse) => {
          if (req.method === "POST") {
            let body = "";
            req.on("data", (chunk: Buffer) => {
              body += chunk.toString();
            });
            req.on("end", () => {
              try {
                const data = JSON.parse(body);
                logger.error({ msg: "OnCall Request Received", ...data });
              } catch {
                logger.error({ msg: "Failed to parse OnCall request", body });
              }
              res.statusCode = 200;
              res.end("OK");
            });
          } else {
            res.statusCode = 405;
            res.end("Method Not Allowed");
          }
        },
      );
    },
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), onCallPlugin()],
});
