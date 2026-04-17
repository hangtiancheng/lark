import type Pool from "../src/pool.js";
import type { IFactory } from "../src/factory-validator.js";
import { describe, it, expect } from "vitest";
import { createPool } from "../src/index.js";
import type { IOptions } from "../src/pool-default.js";
import { FACTORY_CREATE_ERROR } from "../src/errors.js";

interface IResource {
  id: number;
}

export class ResourceFactory implements IFactory<IResource> {
  public created: number = 0;
  public destroyed: number = 0;
  public bin: IResource[] = [];

  create(): Promise<IResource> {
    return Promise.resolve({ id: this.created++ });
  }

  validate(): Promise<boolean> {
    return Promise.resolve(true);
  }

  destroy(resource: IResource): Promise<void> {
    this.destroyed++;
    this.bin.push(resource);
    return Promise.resolve();
  }
}

export async function stopPool(pool: Pool<any>): Promise<void> {
  return pool.drain().then(() => {
    return pool.clear();
  });
}

describe("pool.test.ts", () => {
  // pnpm test tests/pool.test.ts --testNamePattern="test01"
  it("test01", async () => {
    const resourceFactory = new ResourceFactory();
    const pool = createPool(resourceFactory);
    expect(pool.max).toBe(1);
    expect(pool.min).toBe(0);
    await stopPool(pool);
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test02"
  it("test02", async () => {
    const resourceFactory = new ResourceFactory();
    const config = {
      min: "inf" as any,
      max: [] as any,
    };
    const pool = createPool(resourceFactory, config);
    expect(pool.max).toBe(1);
    expect(pool.min).toBe(0);
    await stopPool(pool);
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test03"
  it("test03", async () => {
    const resourceFactory = new ResourceFactory();
    const config: IOptions = {
      min: 5,
      max: 3,
    };
    const pool = createPool(resourceFactory, config);
    expect(pool.max).toBe(3);
    expect(pool.min).toBe(3);
    await stopPool(pool);
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test04"
  it("test04", async () => {
    let borrowTimeLow = 0;
    let borrowTimeHigh = 0;
    let borrowCount = 0;
    const resourceFactory = new ResourceFactory();
    const config: IOptions = {
      max: 1,
      priorityRange: 2,
    };
    const pool = createPool(resourceFactory, config);
    function lowPriorityOnFulfilled(obj: IResource) {
      const time = Date.now();
      if (time > borrowTimeLow) {
        borrowTimeLow = time;
      }
      borrowCount++;
      pool.release(obj);
    }
    function highPriorityOnFulfilled(obj: IResource) {
      const time = Date.now();
      if (time > borrowTimeHigh) {
        borrowTimeHigh = time;
      }
      borrowCount++;
      pool.release(obj);
    }
    const operations: Promise<void>[] = [];
    for (let i = 0; i < 10; i++) {
      const op = pool.acquire(1).then(lowPriorityOnFulfilled);
      operations.push(op);
    }
    for (let i = 0; i < 10; i++) {
      const op = pool.acquire(0).then(highPriorityOnFulfilled);
      operations.push(op);
    }
    await Promise.all(operations);
    expect(borrowCount).toBe(20);
    expect(borrowTimeLow >= borrowTimeHigh).toBe(true);
    await stopPool(pool);
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test05"
  it("test05", async () => {
    const resourceFactory = new ResourceFactory();
    const config: IOptions = {
      min: 2,
      max: 2,
      idleTimeoutMilliseconds: 50,
      evictionRunIntervalMilliseconds: 10,
    };
    const pool = createPool(resourceFactory, config);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const res = await pool.acquire();
    expect(res.id).toBeGreaterThan(1);
    await pool.release(res);
    await stopPool(pool);
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test06"
  it("test06", async () => {
    const count = 5;
    let acquired = 0;
    const resourceFactory = new ResourceFactory();
    const config: IOptions = {
      max: 2,
      idleTimeoutMilliseconds: 300000,
    };
    const pool = createPool(resourceFactory, config);
    const operations: Promise<void>[] = [];
    function onAcquire(client: IResource) {
      acquired += 1;
      expect(typeof client.id).toBe("number");
      setTimeout(() => {
        pool.release(client);
      }, 250);
    }
    for (let i = 0; i < count; i++) {
      const op = pool.acquire().then(onAcquire);
      operations.push(op);
    }
    expect(count).not.toBe(acquired);
    await Promise.all(operations);
    await pool.drain();
    expect(count).toBe(acquired);
    pool.clear();
    await expect(pool.acquire()).rejects.toThrow(Error);
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test07"
  it("test07", async () => {
    let resources: string[] = [];
    const factory: IFactory<string> = {
      create: () => {
        return new Promise<string>((resolve) => {
          const tryCreate = () => {
            const resource = resources.shift();
            if (resource) {
              resolve(resource);
            } else {
              process.nextTick(tryCreate);
            }
          };
          tryCreate();
        });
      },
      destroy: () => Promise.resolve(),
    };
    const pool = createPool(factory, { max: 3, min: 3 });
    const acquirePromise = Promise.all([
      pool.acquire(),
      pool.acquire(),
      pool.acquire(),
    ]);
    acquirePromise.then((all) => {
      all.forEach((resource) => {
        process.nextTick(() => pool.release(resource));
      });
    });
    process.nextTick(() => {
      resources.push("a");
      resources.push("b");
      resources.push("c");
    });
    expect(pool.pending).toBe(3);
    const resolved = await pool.drain().then(() => pool.clear());
    expect(resolved).toBeUndefined();
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test08"
  it("test08", async () => {
    let created = 0;
    const resourceFactory: IFactory<IResource> = {
      create: () => {
        created++;
        if (created < 5) {
          return Promise.reject(new Error("Error occurred."));
        } else {
          return Promise.resolve({ id: created });
        }
      },
      destroy: () => Promise.resolve(),
    };
    const config: IOptions = { max: 1 };
    const pool = createPool<IResource>(resourceFactory, config);
    let called = false;
    const client = await pool.acquire();
    expect(typeof client.id).toBe("number");
    called = true;
    await pool.release(client);
    expect(called).toBe(true);
    expect(pool.pending).toBe(0);
    await stopPool(pool);
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test09"
  it("test09", async () => {
    let attempts = 0;
    const resourceFactory: IFactory<IResource> = {
      create: () => {
        attempts++;
        if (attempts <= 5) {
          return Promise.reject(new Error("Error occurred."));
        } else {
          return Promise.resolve({ id: attempts });
        }
      },
      destroy: () => Promise.resolve(),
    };
    const config: IOptions = { max: 1 };
    const pool = createPool<IResource>(resourceFactory, config);
    let errorCount = 0;
    pool.on(FACTORY_CREATE_ERROR, (err) => {
      expect(err instanceof Error).toBe(true);
      errorCount++;
    });
    let called = false;
    const client = await pool.acquire();
    expect(typeof client.id).toBe("number");
    called = true;
    await pool.release(client);
    expect(called).toBe(true);
    expect(errorCount).toBe(5);
    expect(pool.pending).toBe(0);
    await stopPool(pool);
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test10"
  it("test10", async () => {
    let assertionCount = 0;
    const resourceFactory = new ResourceFactory();
    const config = { max: 2 };
    const pool = createPool(resourceFactory, config);
    const borrowedResources: IResource[] = [];
    expect(pool.size).toBe(0);
    assertionCount += 1;
    const obj1 = await pool.acquire();
    borrowedResources.push(obj1);
    expect(pool.size).toBe(1);
    assertionCount += 1;
    const obj2 = await pool.acquire();
    borrowedResources.push(obj2);
    expect(pool.size).toBe(2);
    assertionCount += 1;
    pool.release(borrowedResources.shift()!);
    pool.release(borrowedResources.shift()!);
    const obj3 = await pool.acquire();
    expect(pool.size).toBe(2);
    assertionCount += 1;
    await pool.release(obj3);
    expect(assertionCount).toBe(4);
    await stopPool(pool);
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test11"
  it("test11", async () => {
    let assertionCount = 0;
    const resourceFactory = new ResourceFactory();
    const config = { max: 2 };
    const pool = createPool(resourceFactory, config);
    const borrowedResources: IResource[] = [];
    expect(pool.available).toBe(0);
    assertionCount += 1;
    const obj1 = await pool.acquire();
    borrowedResources.push(obj1);
    expect(pool.available).toBe(0);
    assertionCount += 1;
    const obj2 = await pool.acquire();
    borrowedResources.push(obj2);
    expect(pool.available).toBe(0);
    assertionCount += 1;
    pool.release(borrowedResources.shift()!);
    expect(pool.available).toBe(1);
    assertionCount += 1;
    pool.release(borrowedResources.shift()!);
    expect(pool.available).toBe(2);
    assertionCount += 1;
    const obj3 = await pool.acquire();
    expect(pool.available).toBe(1);
    assertionCount += 1;
    await pool.release(obj3);
    expect(pool.available).toBe(2);
    assertionCount += 1;
    expect(assertionCount).toBe(7);
    await stopPool(pool);
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test12"
  it("test12", async () => {
    let resourceCreationAttempts = 0;
    const factory: IFactory<{}> = {
      create: () => {
        resourceCreationAttempts++;
        if (resourceCreationAttempts < 2) {
          return Promise.reject(new Error("Create Error"));
        }
        return Promise.resolve({});
      },
      destroy: () => Promise.resolve(),
    };
    const config = { max: 1 };
    const pool = createPool(factory, config);
    const obj = await pool.acquire();
    expect(pool.available).toBe(0);
    await pool.release(obj);
    await stopPool(pool);
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test13"
  it("test13", async () => {
    const pool = createPool(new ResourceFactory(), { max: 1 });
    const obj = await pool.acquire();
    expect(pool.available).toBe(0);
    expect(pool.borrowed).toBe(1);
    await expect(pool.release({} as IResource)).rejects.toThrow(
      /resource not currently part of this pool/,
    );
    expect(pool.available).toBe(0);
    expect(pool.borrowed).toBe(1);
    await pool.release(obj);
    expect(pool.available).toBe(1);
    expect(pool.borrowed).toBe(0);
    await stopPool(pool);
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test14"
  it("test14", async () => {
    const pool = createPool(new ResourceFactory(), { max: 1 });
    const obj = await pool.acquire();
    expect(pool.available).toBe(0);
    expect(pool.borrowed).toBe(1);
    await pool.release(obj);
    await stopPool(pool);
  });

  //! pnpm test tests/pool.test.ts --testNamePattern="test15"
  it("test15", async () => {
    const pool = createPool(new ResourceFactory(), { max: 1 });
    const acquirePromise = pool.acquire().then((obj) => {
      expect(pool.available).toBe(0);
      expect(pool.borrowed).toBe(1);
      expect(pool.pending).toBe(1);
      pool.release(obj);
    });
    const acquirePromise2 = pool.acquire().then((obj) => {
      expect(pool.available).toBe(0);
      expect(pool.borrowed).toBe(1);
      expect(pool.pending).toBe(0);
      pool.release(obj);
    });
    await Promise.all([acquirePromise, acquirePromise2]).then(() =>
      stopPool(pool),
    );
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test16"
  it("test16", async () => {
    const pool = createPool(new ResourceFactory(), { max: 1 });
    const obj = await pool.acquire();
    expect(pool.isBorrowedResource(obj)).toBe(true);
    await pool.release(obj);
    await stopPool(pool);
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test17"
  it("test17", async () => {
    const pool = createPool(new ResourceFactory(), { max: 1 });
    const obj = await pool.acquire();
    await pool.release(obj);
    expect(pool.isBorrowedResource(obj)).toBe(false);
    await stopPool(pool);
  });

  //! pnpm test tests/pool.test.ts --testNamePattern="test18"
  it("test18", async () => {
    const pool = createPool(new ResourceFactory(), { max: 1 });
    const acquirePromise = pool.acquire().then((obj) => {
      expect(pool.available).toBe(0);
      expect(pool.borrowed).toBe(1);
      expect(pool.pending).toBe(1);
      pool.destroy(obj);
    });
    const acquirePromise2 = await pool.acquire().then((obj) => {
      expect(pool.available).toBe(0);
      expect(pool.borrowed).toBe(1);
      expect(pool.pending).toBe(0);
      pool.release(obj);
    });
    await Promise.all([acquirePromise, acquirePromise2]).then(() =>
      stopPool(pool),
    );
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test19"
  it("test19", async () => {
    const pool = createPool(new ResourceFactory(), {
      evictionRunIntervalMilliseconds: 10000,
      autoStart: false,
    });
    // Visit private property `scheduledEviction`
    expect(Reflect.get(pool, "scheduledEviction")).toBe(null);
    const obj = await pool.acquire();
    expect(Reflect.get(pool, "scheduledEviction")).not.toBe(null);
    await pool.release(obj);
    await stopPool(pool);
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test20"
  it("test20", async () => {
    const pool = createPool(new ResourceFactory());
    await pool.use((resource: IResource) => {
      expect(resource.id).toBe(0);
      return Promise.resolve();
    });
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test21"
  it("test21", async () => {
    const pool = createPool(new ResourceFactory());
    let done_with_resource = false;
    const val = await pool.use((resource: IResource) => {
      return new Promise<string>((resolve) => {
        setImmediate(() => {
          done_with_resource = true;
          resolve("value");
        });
      });
    });
    expect(done_with_resource).toBe(true);
    expect(val).toBe("value");
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test22"
  it("test22", async () => {
    const resourceFactory = new ResourceFactory();
    const pool = createPool(resourceFactory, {
      evictionRunIntervalMilliseconds: 10,
    });
    const res = await pool.acquire();
    await pool.release(res);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(resourceFactory.destroyed).toBe(0);
    await stopPool(pool);
  });

  //! pnpm test tests/pool.test.ts --testNamePattern="test23"
  it("test23", async () => {
    let assertionCount = 0;
    const resourceFactory = new ResourceFactory();
    const config: IOptions = {
      max: 2,
      maxWaitingClients: 0,
    };
    const pool = createPool(resourceFactory, config);
    const borrowedResources: IResource[] = [];
    expect(pool.size).toBe(0);
    assertionCount += 1;
    const obj1 = await pool.acquire();
    borrowedResources.push(obj1);
    expect(pool.size).toBe(1);
    assertionCount += 1;
    const obj2 = await pool.acquire();
    borrowedResources.push(obj2);
    expect(pool.size).toBe(2);
    assertionCount += 1;
    await expect(pool.acquire()).rejects.toThrow(
      "max waiting clients count exceeded",
    );
  });

  // pnpm test tests/pool.test.ts --testNamePattern="test24"
  it("test24", async () => {
    const resourceFactory = new ResourceFactory();
    const config: IOptions = {
      min: 2,
      max: 4,
    };
    const pool = createPool(resourceFactory, config);
    await pool.ready();
    expect(pool.available).toBeGreaterThanOrEqual(config.min!);
    await stopPool(pool);
  });
});
