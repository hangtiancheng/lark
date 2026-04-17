import { describe, it, expect } from "vitest";
import type { IFactory } from "../src/factory-validator.js";
import type { IOptions } from "../src/pool-default.js";
import { createPool } from "../src/index.js";
import { FACTORY_DESTROY_ERROR } from "../src/errors.js";

describe("pool-destroy-timeout.test.ts", () => {
  it("test", async () => {
    const factory: IFactory<{}> = {
      create: () => Promise.resolve({}),
      destroy: () => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            resolve();
          }, 100);
        });
      },
    };
    const config: IOptions = {
      destroyTimeoutMilliseconds: 20,
    };
    const pool = createPool(factory, config);
    const resource = await pool.acquire();
    pool.destroy(resource);
    await new Promise<void>((resolve) => {
      pool.once(FACTORY_DESTROY_ERROR, (err) => {
        expect(err).toBeInstanceOf(Error);
        if (err instanceof Error) {
          expect(err.message).toMatch(/destroy timed out/);
        }
        resolve();
      });
    });
  });

  it("test2", async () => {
    const factory: IFactory<{}> = {
      create: () => Promise.resolve({}),
      destroy: () => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            resolve();
          }, 10);
        });
      },
    };
    const config: IOptions = {
      destroyTimeoutMilliseconds: 400,
    };
    const pool = createPool(factory, config);
    let errorEmitted = false;
    pool.once(FACTORY_DESTROY_ERROR, () => {
      errorEmitted = true;
    });
    const resource = await pool.acquire();
    pool.destroy(resource);
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 20);
    });
    expect(errorEmitted).toBe(false);
  });
});
