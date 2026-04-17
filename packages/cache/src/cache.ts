import { Lru } from "./lru.js";
import { PeerGetter, PeerPicker } from "./peers.js";
import { Throttle } from "./throttle.js";
import { ByteView } from "./byte-view.js";

class Cache {
  private cache: Lru<ByteView> | null = null;
  private maxBytes: number;

  constructor(maxBytes: number) {
    this.maxBytes = maxBytes;
  }

  add(key: string, value: ByteView): void {
    if (!this.cache) {
      this.cache = new Lru(this.maxBytes);
    }
    this.cache.add(key, value);
  }

  get(key: string): [ByteView | undefined, boolean] {
    if (!this.cache) {
      return [undefined, false];
    }
    return this.cache.get(key);
  }
}

export type LoadFunc = (key: string) => Promise<Buffer>;

export class Group {
  private name: string;
  private loader: LoadFunc;
  private cache: Cache;
  private peerPicker: PeerPicker | null = null;
  private throttle: Throttle;

  constructor(name: string, maxBytes: number, loader: LoadFunc) {
    this.name = name;
    this.loader = loader;
    this.cache = new Cache(maxBytes);
    this.throttle = new Throttle();
  }

  async get(key: string): Promise<ByteView> {
    if (!key) {
      throw new Error("key is empty");
    }
    const [value, ok] = this.cache.get(key);
    if (ok && value) {
      console.log("[cache-js] cache hit");
      return value;
    }
    return this.loadThrottled(key);
  }

  private async loadThrottled(key: string): Promise<ByteView> {
    return this.throttle.do(key, async () => {
      if (this.peerPicker) {
        const [peerGetter, ok] = this.peerPicker.pickPeer(key);
        if (ok && peerGetter) {
          try {
            const value = await this.loadFromPeer(peerGetter, key);
            return value;
          } catch (error) {
            console.log("[cache-js] load from peer failed");
          }
        }
      }
      return this.loadLocally(key);
    });
  }

  private async loadLocally(key: string): Promise<ByteView> {
    const bytes = await this.loader(key);
    const value = new ByteView(Buffer.from(bytes));
    this.populateCache(key, value);
    return value;
  }

  private async loadFromPeer(
    peerGetter: PeerGetter,
    key: string,
  ): Promise<ByteView> {
    const bytes = await peerGetter.get(this.name, key);
    return new ByteView(bytes);
  }

  private populateCache(key: string, value: ByteView): void {
    this.cache.add(key, value);
  }

  setPeerPicker(peerPicker: PeerPicker): void {
    if (!this.peerPicker) {
      this.peerPicker = peerPicker;
    }
  }

  getName(): string {
    return this.name;
  }
}

const groups: Map<string, Group> = new Map();

export function newGroup(
  name: string,
  maxBytes: number,
  loader: LoadFunc,
): Group {
  if (!loader) {
    throw new Error("loader is empty");
  }
  const group = new Group(name, maxBytes, loader);
  groups.set(name, group);
  return group;
}

export function getGroup(name: string): Group | undefined {
  return groups.get(name);
}
