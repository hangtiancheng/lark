/**
 * Service: API request management with caching, deduplication, and queue.
 *
 * - Service.extend(syncFn, cacheMax?, cacheBuffer?): creates subclass with sync function
 * - Service.add(attrs): registers API endpoint metadata
 * - new Service().all(attrs, done): fetch all, use cache when available
 * - new Service().one(attrs, done): fetch all, callback on each completion
 * - new Service().save(attrs, done): fetch all, skip cache (always request)
 * - enqueue/dequeue: task queue for sequential async operations
 * - destroy: cancel pending requests
 * - Payload: response wrapper with get/set
 */
import { SPLITTER } from "./common";
import { assign, funcWithTry, noop, generateId, now } from "./utils";
import { Cache } from "./cache";
import { EventEmitter } from "./event-emitter";
import type {
  AnyFunc,
  ServiceMetaEntry,
  ServiceCacheInfo,
  PendingCacheEntry,
  PayloadInterface,
  EventEmitterInterface,
} from "./types";

// ============================================================
// Payload: response wrapper
// ============================================================

/**
 * Payload wraps API response data with convenient access methods.
 */
export class Payload implements PayloadInterface {
  /** Payload data */
  data: Record<string, unknown>;

  /** Internal cache info */
  cacheInfo?: ServiceCacheInfo;

  constructor(data: Record<string, unknown> = {}) {
    this.data = data;
  }

  /** Get a value from payload data */
  get<T = unknown>(key: string): T {
    return this.data[key] as T;
  }

  /** Set a value in payload data */
  set(
    keyOrData: string | Record<string, unknown> | ServiceMetaEntry,
    value?: unknown,
  ): PayloadInterface {
    if (typeof keyOrData === "string") {
      this.data[keyOrData] = value;
    } else {
      assign(this.data, keyOrData);
    }
    return this;
  }
}

// ============================================================
// Fetch flags
// ============================================================

const FETCH_FLAGS_ALL = 1;
const FETCH_FLAGS_ONE = 2;

// ============================================================
// ServiceSendTarget: minimal interface for serviceSend
// ============================================================

/**
 * Minimal interface describing what serviceSend actually uses
 * from a service instance. This avoids coupling to the full
 * ServiceInterface which mixes instance and static methods.
 */
interface ServiceSendTarget {
  destroyed: number;
  busy: number;
  internals: {
    metaList: Record<string, ServiceMetaEntry>;
    payloadCache: Cache<Payload>;
    pendingCacheKeys: Record<string, PendingCacheEntry>;
    syncFn: (payload: Payload, callback: () => void) => void;
    staticEmitter: EventEmitter;
  };
  type: {
    get(
      attrs: Record<string, unknown>,
      createNew?: boolean,
    ): { entity: Payload; needsUpdate: boolean };
  };
  enqueue(callback: AnyFunc): unknown;
}

// ============================================================
// Service class (ES6, following the View.ts pattern)
// ============================================================

/**
 * Service: API request management with caching, deduplication, and queue.
 *
 * - Service.extend(syncFn, cacheMax?, cacheBuffer?): creates subclass with sync function
 * - Service.add(attrs): registers API endpoint metadata
 * - new Service().all(attrs, done): fetch all, use cache when available
 * - new Service().one(attrs, done): fetch all, callback on each completion
 * - new Service().save(attrs, done): fetch all, skip cache (always request)
 * - enqueue/dequeue: task queue for sequential async operations
 * - destroy: cancel pending requests
 *
 * Per-type state (metaList, payloadCache, pendingCacheKeys, syncFn, staticEmitter)
 * is stored as static class properties. When extend() creates a subclass,
 * each subclass gets its own copies of these static properties, ensuring
 * isolation between different Service types.
 */
export class Service {
  /** Service instance ID */
  id = "";

  /** Whether service is busy (1 = busy) */
  busy = 0;

  /** Whether service is destroyed (1 = destroyed) */
  destroyed = 0;

  /** Task queue for sequential operations */
  taskQueue: AnyFunc[] = [];

  /** Previous dequeue arguments */
  prevArgs: unknown[] = [];

  /** Instance event emitter */
  private _emitter = new EventEmitter();

  constructor() {
    this.id = generateId("service");
  }

  // ============================================================
  // Instance accessors for type-level data
  // ============================================================

  /** Instance event emitter (public accessor) */
  get emitter(): EventEmitterInterface {
    return this._emitter;
  }

  /**
   * Get internals object for serviceSend compatibility.
   * References per-type static state from the current class.
   */
  get internals(): ServiceSendTarget["internals"] {
    const constructor = this.constructor as typeof Service;
    return {
      metaList: constructor._metaList,
      payloadCache: constructor._payloadCache,
      pendingCacheKeys: constructor._pendingCacheKeys,
      syncFn: constructor._syncFn,
      staticEmitter: constructor._staticEmitter,
    };
  }

  /**
   * Get type reference (the constructor) for serviceSend compatibility.
   * Static methods like get/create are accessible via the constructor.
   */
  get type(): ServiceSendTarget["type"] {
    return this.constructor as unknown as ServiceSendTarget["type"];
  }

  // ============================================================
  // Instance methods
  // ============================================================

  /**
   * Fetch all endpoints, callback when all complete.
   * Uses cache when available.
   */
  all(
    attrs:
      | string
      | Record<string, unknown>
      | (string | Record<string, unknown>)[],
    done: AnyFunc,
  ): this {
    serviceSend(this, attrs, done, FETCH_FLAGS_ALL, false);
    return this;
  }

  /**
   * Fetch all endpoints, callback on each completion.
   */
  one(
    attrs:
      | string
      | Record<string, unknown>
      | (string | Record<string, unknown>)[],
    done: AnyFunc,
  ): this {
    serviceSend(this, attrs, done, FETCH_FLAGS_ONE, false);
    return this;
  }

  /**
   * Fetch all endpoints, skip cache (always request).
   */
  save(
    attrs:
      | string
      | Record<string, unknown>
      | (string | Record<string, unknown>)[],
    done: AnyFunc,
  ): this {
    serviceSend(this, attrs, done, FETCH_FLAGS_ALL, true);
    return this;
  }

  /**
   * Enqueue a task for sequential execution.
   */
  enqueue(callback: AnyFunc): this {
    if (!this.destroyed) {
      this.taskQueue.push(callback);
      this.dequeue(...this.prevArgs);
    }
    return this;
  }

  /**
   * Dequeue and execute the next task in queue.
   */
  dequeue(...args: unknown[]): void {
    if (!this.busy && !this.destroyed) {
      this.busy = 1;
      setTimeout(() => {
        this.busy = 0;
        if (!this.destroyed) {
          const task = this.taskQueue.shift();
          if (task) {
            this.prevArgs = args;
            funcWithTry(task, args, this, noop);
          }
        }
      }, 0);
    }
  }

  /**
   * Destroy the service instance.
   * After destruction, no new requests can be sent.
   */
  destroy(): void {
    this.destroyed = 1;
    this.taskQueue = [];
  }

  // Instance event methods (delegate to instance emitter)
  on(event: string, handler: AnyFunc): this {
    this._emitter.on(event, handler);
    return this;
  }

  off(event: string, handler?: AnyFunc): this {
    this._emitter.off(event, handler);
    return this;
  }

  fire(event: string, data?: Record<string, unknown>): this {
    this._emitter.fire(event, data);
    return this;
  }

  // ============================================================
  // Per-type static state
  // ============================================================

  /** Per-type metadata registry */
  static _metaList: Record<string, ServiceMetaEntry> = {};

  /** Per-type payload cache (LFU with frequency eviction) */
  static _payloadCache = new Cache<Payload>({
    maxSize: 20,
    bufferSize: 5,
  });

  /** Per-type pending cache keys for deduplication */
  static _pendingCacheKeys: Record<string, PendingCacheEntry> = {};

  /** Per-type sync function */
  static _syncFn: (payload: Payload, callback: () => void) => void = noop;

  /** Per-type static event emitter */
  static _staticEmitter = new EventEmitter();

  /** Per-type cache max size */
  static _cacheMax = 20;

  /** Per-type cache buffer size */
  static _cacheBuffer = 5;

  // ============================================================
  // Static methods (operate on per-type state via `this`)
  // ============================================================

  /**
   * Register API endpoint metadata.
   */
  static add(attrs: ServiceMetaEntry | ServiceMetaEntry[]): void {
    if (!Array.isArray(attrs)) {
      attrs = [attrs];
    }
    for (const payload of attrs) {
      if (payload) {
        const name = payload.name;
        const cache = payload.cache;
        payload.cache = cache ? cache | 0 : 0;
        this._metaList[name] = payload;
      }
    }
  }

  /**
   * Get metadata for an API endpoint.
   */
  static meta(attrs: string | Record<string, unknown>): ServiceMetaEntry {
    const name =
      typeof attrs === "string" ? attrs : String(attrs["name"] ?? "");
    const known = this._metaList[name];
    if (known) return known;
    return attrs as ServiceMetaEntry;
  }

  /**
   * Create a Payload for an API request.
   */
  static create(attrs: Record<string, unknown>): Payload {
    const meta = this.meta(attrs);
    const cache = toCacheValue(attrs["cache"]) || meta.cache || 0;
    const entity = new Payload();
    entity.set(meta);
    entity.cacheInfo = {
      name: meta.name,
      after: typeof meta.after === "function" ? meta.after : undefined,
      cleans: typeof meta.cleanKeys === "string" ? meta.cleanKeys : undefined,
      key: cache ? defaultCacheKey(meta, attrs) : "",
      time: 0,
    };
    if (attrs !== null) {
      entity.set(attrs);
    }
    const before = meta.before;
    if (typeof before === "function") {
      funcWithTry(before, [entity], entity, noop);
    }
    this._staticEmitter.fire("begin", { payload: entity });
    return entity;
  }

  /**
   * Get or create a Payload for an API request.
   */
  static get(
    attrs: Record<string, unknown>,
    createNew?: boolean,
  ): { entity: Payload; needsUpdate: boolean } {
    let entity: Payload | undefined;
    let needsUpdate = false;
    if (!createNew) {
      entity = this.cached(attrs);
    }
    if (!entity) {
      entity = this.create(attrs);
      needsUpdate = true;
    }
    return { entity, needsUpdate };
  }

  /**
   * Get cached Payload if available and not expired.
   */
  static cached(attrs: Record<string, unknown>): Payload | undefined {
    const meta = this.meta(attrs);
    const cache = toCacheValue(attrs["cache"]) || meta.cache || 0;
    let cacheKey = "";
    if (cache) {
      cacheKey = defaultCacheKey(meta, attrs);
    }
    if (cacheKey) {
      const info = this._pendingCacheKeys[cacheKey];
      if (info) {
        const entity = info.entity;
        return entity instanceof Payload ? entity : undefined;
      }
      const cached = this._payloadCache.get(cacheKey);
      if (cached && cached.cacheInfo) {
        if (now() - cached.cacheInfo.time > cache) {
          this._payloadCache.del(cacheKey);
          return undefined;
        }
        return cached;
      }
    }
    return undefined;
  }

  /**
   * Clear cached payloads by endpoint name.
   */
  static clear(names: string | string[]): void {
    const nameSet = new Set(
      (typeof names === "string" ? names : names.join(",")).split(","),
    );
    const keysToDelete: string[] = [];
    this._payloadCache.forEach((payload) => {
      const info = payload?.cacheInfo;
      if (info && info.key && nameSet.has(info.name)) {
        keysToDelete.push(info.key);
      }
    });
    for (const key of keysToDelete) {
      this._payloadCache.del(key);
    }
  }

  // Static event methods (operate on per-type emitter)
  static on(event: string, handler: AnyFunc): void {
    this._staticEmitter.on(event, handler);
  }

  static off(event: string, handler?: AnyFunc): void {
    this._staticEmitter.off(event, handler);
  }

  static fire(event: string, data?: Record<string, unknown>): void {
    this._staticEmitter.fire(event, data);
  }

  /**
   * Create a new Service subclass with a custom sync function.
   *
   * Each subclass gets its OWN copies of every per-type static field
   * (`_metaList`, `_payloadCache`, `_pendingCacheKeys`, `_syncFn`,
   * `_staticEmitter`, `_cacheMax`, `_cacheBuffer`) via `static override`.
   * This is intentional: it ensures that endpoint metadata, cache state,
   * in-flight dedup keys, and event subscribers are fully isolated between
   * different Service types, even when one extends another.
   *
   * **Do not refactor these `static override` declarations away** — sharing
   * them through prototype inheritance would let endpoints registered on one
   * subclass leak into another, and the LFU cache evictions of one type
   * would race with those of another.
   */
  static extend(
    this: typeof Service,
    newSyncFn: (payload: Payload, callback: () => void) => void,
    newCacheMax?: number,
    newCacheBuffer?: number,
  ): typeof Service {
    const ParentService = this;

    class ChildService extends ParentService {
      // Intentionally per-subclass — see Service.extend doc.
      static override _metaList: Record<string, ServiceMetaEntry> = {};
      static override _payloadCache = new Cache<Payload>({
        maxSize: newCacheMax || ParentService._cacheMax,
        bufferSize: newCacheBuffer || ParentService._cacheBuffer,
      });
      static override _pendingCacheKeys: Record<string, PendingCacheEntry> = {};
      static override _syncFn = newSyncFn;
      static override _staticEmitter = new EventEmitter();
      static override _cacheMax = newCacheMax || ParentService._cacheMax;
      static override _cacheBuffer =
        newCacheBuffer || ParentService._cacheBuffer;
    }

    return ChildService;
  }
}

// ============================================================
// Internal helpers
// ============================================================

/** Memoize `JSON.stringify(meta)` — meta entries are immutable after `add()`. */
const metaJsonCache = new WeakMap<ServiceMetaEntry, string>();

function getMetaJson(meta: ServiceMetaEntry): string {
  let cached = metaJsonCache.get(meta);
  if (cached === undefined) {
    cached = JSON.stringify(meta);
    metaJsonCache.set(meta, cached);
  }
  return cached;
}

function defaultCacheKey(
  meta: ServiceMetaEntry,
  attrs: Record<string, unknown>,
): string {
  return JSON.stringify(attrs) + SPLITTER + getMetaJson(meta);
}

/** Coerce an unknown cache TTL value to a non-negative integer (ms). */
function toCacheValue(v: unknown): number {
  if (typeof v === "number") return v | 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n | 0 : 0;
  }
  return 0;
}

/**
 * Service_Send: fetch attrs, handle caching and deduplication.
 */
function serviceSend(
  service: ServiceSendTarget,
  attrs:
    | string
    | Record<string, unknown>
    | (string | Record<string, unknown>)[],
  done: AnyFunc,
  flag: number,
  save: boolean,
): void {
  if (service.destroyed) return;
  if (service.busy) {
    const queued: AnyFunc = () => serviceSend(service, attrs, done, flag, save);
    service.enqueue(queued);
    return;
  }

  service.busy = 1;

  let attrList: (string | Record<string, unknown>)[];
  if (typeof attrs === "string") {
    attrList = [{ name: attrs }];
  } else if (Array.isArray(attrs)) {
    attrList = attrs;
  } else {
    attrList = [attrs];
  }

  const internals = service.internals;
  const { syncFn, pendingCacheKeys, staticEmitter } = internals;
  let requestCount = 0;
  const total = attrList.length;
  const doneArr: unknown[] = new Array(total + 1);
  const errorArgs: unknown[] = [];

  const remoteComplete = (idx: number, error?: unknown): void => {
    const payload = doneArr[idx + 1];
    let newPayload = false;

    if (error) {
      errorArgs[idx] = error;
      staticEmitter.fire("fail", { payload, error } as Record<string, unknown>);
    } else {
      newPayload = true;
      staticEmitter.fire("done", { payload } as Record<string, unknown>);
    }

    if (!service.destroyed) {
      const finish = requestCount === total;
      if (finish) {
        service.busy = 0;
        if (flag === FETCH_FLAGS_ALL) {
          doneArr[0] = errorArgs;
          funcWithTry(done, doneArr, service, noop);
        }
      }
      if (flag === FETCH_FLAGS_ONE) {
        funcWithTry(done, [error || null, payload, finish, idx], service, noop);
      }
    }

    if (newPayload) {
      staticEmitter.fire("end", { payload, error } as Record<string, unknown>);
    }
  };

  for (const attr of attrList) {
    if (!attr) continue;

    const attrObj: Record<string, unknown> =
      typeof attr === "string" ? { name: attr } : attr;
    const payloadInfo = service.type.get(attrObj, save);
    const payloadEntity = payloadInfo.entity;
    const cacheKey = payloadEntity.cacheInfo?.key || "";
    // Added by Qwen3.7
    doneArr[requestCount + 1] = payloadEntity;
    const complete = remoteComplete.bind(null, requestCount++);

    if (cacheKey && pendingCacheKeys[cacheKey]) {
      pendingCacheKeys[cacheKey].push(complete);
    } else if (payloadInfo.needsUpdate) {
      if (cacheKey) {
        const cacheList: PendingCacheEntry = [complete];
        cacheList.entity = payloadEntity;
        pendingCacheKeys[cacheKey] = cacheList;

        const cacheComplete = (): void => {
          const list = pendingCacheKeys[cacheKey];
          const entity = list.entity;
          if (entity instanceof Payload && entity.cacheInfo) {
            entity.cacheInfo.time = now();
            internals.payloadCache.set(cacheKey, entity);
          }
          Reflect.deleteProperty(pendingCacheKeys, cacheKey);
          for (const cb of list) {
            if (typeof cb === "function") cb();
          }
        };

        syncFn(payloadEntity, cacheComplete);
      } else {
        syncFn(payloadEntity, complete);
      }
    } else {
      complete();
    }
  }
}
