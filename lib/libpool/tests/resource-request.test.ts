import { describe, it, expect } from "vitest";
import ResourceRequest from "../src/resource-request.js";

describe("resource-request.test.ts", () => {
  it("test", () => {
    const create = () => {
      new ResourceRequest(undefined);
    };
    expect(create).not.toThrow();
  });

  it("test2", async () => {
    const request = new ResourceRequest(10);
    try {
      await request.promise;
      expect.fail("should not resolve");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      if (err instanceof Error) {
        expect(err.message).toMatch(/resource request timed out/);
      }
    }
  });

  it("test3", async () => {
    const resource = {};
    const request = new ResourceRequest(undefined);
    request.resolve(resource);
    const result = await request.promise;
    expect(result).toBe(resource);
  });

  it("test4", async () => {
    const request = new ResourceRequest(10);
    request.removeTimeout();
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 20);
    });
    expect(request.promise).toBeInstanceOf(Promise);
  });

  it("test5", () => {
    const request = new ResourceRequest(undefined);
    expect(() => {
      request.resolve({});
    }).not.toThrow();
    expect(() => {
      request.resolve({});
    }).not.toThrow();
  });
});
