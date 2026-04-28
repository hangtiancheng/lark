import { isReadonly, shallowReadonly } from "../reactive";
import { describe, it, expect, vi } from "vitest";

describe("shallowReadonly", () => {
  it("test", () => {
    const obj = shallowReadonly({ n: { foo: 1 } });
    expect(isReadonly(obj)).toBe(true);
    expect(isReadonly(obj.n)).toBe(false);
  });

  it("test2", () => {
    console.warn = vi.fn();
    const user = shallowReadonly({ age: 10 });
    user.age = 11;
    expect(console.warn).toHaveBeenCalled();
  });
});
