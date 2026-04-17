import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createClient, type RedisClientType } from "redis";
import { DistributedLock, type LockHandle } from "../src/index.js";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_PREFIX = "test:distributed-lock:";
let keySeq = 0;

/** Unique key per test case — eliminates cross-test interference. */
function uniqueKey(): string {
  return `${TEST_PREFIX}${process.pid}:${Date.now()}:${++keySeq}`;
}

function uuid(): string {
  return crypto.randomUUID();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("DistributedLock", () => {
  let redis: RedisClientType;
  let lock: DistributedLock;

  /** Track handles so afterEach can release any leaked locks. */
  const activeHandles: LockHandle[] = [];

  beforeAll(async () => {
    redis = createClient();
    await redis.connect();
    lock = new DistributedLock(redis);
  });

  afterEach(async () => {
    for (const h of activeHandles) {
      try {
        await h.release();
      } catch {
        /* already released or connection closed — safe to ignore */
      }
    }
    activeHandles.length = 0;
  });

  afterAll(async () => {
    lock.stopAllRenewals();
    await redis.quit();
  });

  /** Acquire a lock and auto-track it for cleanup. */
  async function acquireTracked(
    ...args: Parameters<DistributedLock["acquire"]>
  ): Promise<LockHandle | null> {
    const handle = await lock.acquire(...args);
    if (handle) activeHandles.push(handle);
    return handle;
  }

  // -----------------------------------------------------------------------
  // Basic acquire / release
  // -----------------------------------------------------------------------

  it("should acquire a lock successfully", async () => {
    const key = uniqueKey();
    const ownerId = uuid();

    const handle = await acquireTracked({ key, ownerId, ttlMs: 5000 });

    expect(handle).not.toBeNull();
    expect(handle!.key).toBe(key);
    expect(handle!.ownerId).toBe(ownerId);

    const value = await redis.get(key);
    expect(value).toBe(ownerId);
  });

  it("should release a lock successfully", async () => {
    const key = uniqueKey();
    const ownerId = uuid();

    const handle = await acquireTracked({ key, ownerId, ttlMs: 5000 });
    expect(handle).not.toBeNull();

    const released = await handle!.release();
    expect(released).toBe(true);

    const value = await redis.get(key);
    expect(value).toBeNull();
  });

  it("should return false when releasing a non-existent lock", async () => {
    const released = await lock.release(uniqueKey(), uuid());
    expect(released).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Mutual exclusion
  // -----------------------------------------------------------------------

  it("should fail to acquire a lock already held by another owner", async () => {
    const key = uniqueKey();

    const handle1 = await acquireTracked({ key, ownerId: uuid(), ttlMs: 5000 });
    expect(handle1).not.toBeNull();

    const handle2 = await acquireTracked({ key, ownerId: uuid(), ttlMs: 5000 });
    expect(handle2).toBeNull();
  });

  it("should not release a lock held by a different owner", async () => {
    const key = uniqueKey();
    const owner1 = uuid();

    const handle = await acquireTracked({ key, ownerId: owner1, ttlMs: 5000 });
    expect(handle).not.toBeNull();

    const released = await lock.release(key, uuid());
    expect(released).toBe(false);

    const value = await redis.get(key);
    expect(value).toBe(owner1);
  });

  // -----------------------------------------------------------------------
  // TTL expiry
  // -----------------------------------------------------------------------

  it("should auto-expire after ttlMs", async () => {
    const key = uniqueKey();

    await acquireTracked({ key, ownerId: uuid(), ttlMs: 300 });
    await sleep(400);

    const value = await redis.get(key);
    expect(value).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Retry
  // -----------------------------------------------------------------------

  it("should retry and acquire after the existing lock expires", async () => {
    const key = uniqueKey();
    const owner2 = uuid();

    // Owner 1 holds lock for 300 ms
    await acquireTracked({ key, ownerId: uuid(), ttlMs: 300 });

    // Owner 2 retries — should succeed once owner 1's lock expires
    const handle2 = await acquireTracked({
      key,
      ownerId: owner2,
      ttlMs: 5000,
      retryCount: 10,
      retryDelayMs: 100,
      retryWithBackoff: false, // fixed interval for deterministic test timing
    });

    expect(handle2).not.toBeNull();
    expect(handle2!.ownerId).toBe(owner2);
  });

  it("should return null when retries are exhausted", async () => {
    const key = uniqueKey();

    // Owner 1 holds lock for 5 s — will outlive owner 2's retry budget
    await acquireTracked({ key, ownerId: uuid(), ttlMs: 5000 });

    const handle2 = await acquireTracked({
      key,
      ownerId: uuid(),
      ttlMs: 5000,
      retryCount: 2,
      retryDelayMs: 50,
      retryWithBackoff: false,
    });

    expect(handle2).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Manual renewal
  // -----------------------------------------------------------------------

  it("should renew a held lock", async () => {
    const key = uniqueKey();
    const ownerId = uuid();

    await acquireTracked({ key, ownerId, ttlMs: 5000 });

    const renewed = await lock.renew(key, ownerId, 10000);
    expect(renewed).toBe(true);

    const pttl = await redis.pTTL(key);
    expect(pttl).toBeGreaterThan(5000);
  });

  it("should not renew a lock owned by someone else", async () => {
    const key = uniqueKey();

    await acquireTracked({ key, ownerId: uuid(), ttlMs: 5000 });

    const renewed = await lock.renew(key, uuid(), 10000);
    expect(renewed).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Auto-renewal (watchdog)
  // -----------------------------------------------------------------------

  it("should keep the lock alive beyond initial ttl with autoRenew", async () => {
    const key = uniqueKey();
    const ownerId = uuid();

    const handle = await acquireTracked({
      key,
      ownerId,
      ttlMs: 300,
      autoRenew: true,
    });
    expect(handle).not.toBeNull();

    // Wait well past the original TTL
    await sleep(500);

    // Lock must still be alive
    const value = await redis.get(key);
    expect(value).toBe(ownerId);

    await handle!.release();
  });

  // -----------------------------------------------------------------------
  // Input validation
  // -----------------------------------------------------------------------

  it("should throw RangeError on ttlMs <= 0", async () => {
    await expect(
      lock.acquire({ key: uniqueKey(), ownerId: uuid(), ttlMs: 0 }),
    ).rejects.toThrow(RangeError);

    await expect(
      lock.acquire({ key: uniqueKey(), ownerId: uuid(), ttlMs: -1 }),
    ).rejects.toThrow(RangeError);
  });

  it("should throw TypeError on empty key", async () => {
    await expect(
      lock.acquire({ key: "", ownerId: uuid(), ttlMs: 1000 }),
    ).rejects.toThrow(TypeError);
  });

  it("should throw TypeError on empty ownerId", async () => {
    await expect(
      lock.acquire({ key: uniqueKey(), ownerId: "", ttlMs: 1000 }),
    ).rejects.toThrow(TypeError);
  });
});
