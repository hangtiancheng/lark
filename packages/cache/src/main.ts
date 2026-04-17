import Koa from "koa";
import Router from "@koa/router";
import { HttpServer } from "./server.js";
import { Group, newGroup } from "./cache.js";

const GROUP_NAME = "user";
const MAX_BYTES = 2 << 10; // 2KB
const PROTOCOL = "http://";

const database: Record<string, string> = {
  Alice: "1",
  Bob: "2",
  Lark: "3",
};

function createGroup(): Group {
  return newGroup(
    GROUP_NAME,
    MAX_BYTES,
    async (key: string): Promise<Buffer> => {
      console.log("[database] search key", key);
      if (key in database) {
        return Buffer.from(database[key]);
      }
      throw new Error(`key ${key} not found`);
    },
  );
}

function startCacheServer(
  serverAddr: string,
  clientAddrs: string[],
  group: Group,
): void {
  const httpServer = new HttpServer(serverAddr);
  httpServer.construct(...clientAddrs);
  group.setPeerPicker(httpServer);
  const port = parseInt(serverAddr.split(":").pop() || "8001");
  httpServer.listen(port);
}

function startApiServer(apiServerAddr: string, group: Group): void {
  const app = new Koa();
  const router = new Router();
  app.on("error", (err) => {
    console.error("[api] app error:", err.message);
  });
  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      ctx.status = 500;
      ctx.body = (err as Error).message;
      console.error("[api] error:", (err as Error).message);
    }
  });
  router.get("/api", async (ctx) => {
    const key = ctx.query.key as string;
    console.log("[api] key", key);
    if (!key) {
      ctx.status = 400;
      ctx.body = "key is required";
      return;
    }
    try {
      const byteView = await group.get(key);
      ctx.set("Content-Type", "application/octet-stream");
      ctx.body = byteView.view();
    } catch (error) {
      ctx.status = 500;
      ctx.body = (error as Error).message;
    }
  });
  app.use(router.routes());
  app.use(router.allowedMethods());
  const port = parseInt(apiServerAddr.split(":").pop() || "9000");
  app.listen(port, () => {
    console.log(`api server is running at ${apiServerAddr}`);
  });
}

function main(): void {
  const args = process.argv.slice(2);
  let port = 8001;
  let api = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-port" || args[i] === "--port") {
      port = parseInt(args[i + 1]) || 8001;
      i++;
    } else if (args[i] === "-api" || args[i] === "--api") {
      api = true;
    }
  }
  const apiAddr = `${PROTOCOL}127.0.0.1:9000`;
  const clientPort2addr: Record<number, string> = {
    8001: `${PROTOCOL}127.0.0.1:8001`,
    8002: `${PROTOCOL}127.0.0.1:8002`,
    8003: `${PROTOCOL}127.0.0.1:8003`,
  };
  const clientAddrs = Object.values(clientPort2addr);
  const group = createGroup();
  if (api) {
    startApiServer(apiAddr, group);
  }
  startCacheServer(clientPort2addr[port], clientAddrs, group);
}

main();
