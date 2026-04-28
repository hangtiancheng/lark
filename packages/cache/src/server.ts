import Koa from "koa";
import Router from "@koa/router";
import { ConsistentHash } from "./consistent-hash.js";
import { getGroup } from "./cache.js";
import { PeerGetter, PeerPicker } from "./peers.js";
import { HttpClient } from "./client.js";

const DEFAULT_REPLICAS = 50;
const DEFAULT_BASE_URL = "/cache-js";

export class HttpServer implements PeerPicker {
  private host: string; // e.g. http://127.0.0.1:8000
  private baseUrl: string;
  private consistentHash: ConsistentHash | null = null;
  private host2httpGetters: Map<string, HttpClient> = new Map();
  private app: Koa;
  private router: Router;

  constructor(host: string) {
    this.host = host;
    this.baseUrl = DEFAULT_BASE_URL;
    this.app = new Koa();
    this.router = new Router();
    this.app.on("error", (err) => {
      console.error("[cache-js] app error:", err.message);
    });
    this.app.use(async (ctx, next) => {
      try {
        await next();
      } catch (err) {
        ctx.status = 500;
        ctx.body = (err as Error).message;
        console.error("[cache-js] error:", (err as Error).message);
      }
    });
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get(`${this.baseUrl}/:group/:key`, async (ctx) => {
      const { group: groupName, key } = ctx.params;
      const group = getGroup(groupName);
      if (!group) {
        ctx.status = 500;
        ctx.body = `[cache-js] group ${groupName} not found`;
        return;
      }
      try {
        const byteView = await group.get(key);
        ctx.set("Content-Type", "application/octet-stream");
        ctx.body = byteView.view();
      } catch (error) {
        ctx.status = 500;
        ctx.body = `[cache-js] get key ${key} from group ${groupName} error`;
      }
    });

    this.app.use(this.router.routes());
    this.app.use(this.router.allowedMethods());
  }

  construct(...hosts: string[]): void {
    this.consistentHash = new ConsistentHash(DEFAULT_REPLICAS);
    this.consistentHash.addRealNode(...hosts);
    for (const host of hosts) {
      this.host2httpGetters.set(
        host,
        new HttpClient(host + this.baseUrl + "/"),
      );
    }
  }

  pickPeer(key: string): [PeerGetter | null, boolean] {
    if (!this.consistentHash) {
      return [null, false];
    }
    const [realNodeKey, ok] = this.consistentHash.getRealNode(key);
    if (ok && realNodeKey !== this.host) {
      const getter = this.host2httpGetters.get(realNodeKey);
      return [getter || null, !!getter];
    }
    return [null, false];
  }

  getApp(): Koa {
    return this.app;
  }

  listen(port: number): void {
    this.app.listen(port, () => {
      console.log(`cache server is running at ${this.host}`);
    });
  }
}
