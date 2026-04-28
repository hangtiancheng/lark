/* eslint-disable @typescript-eslint/no-explicit-any */
import { reactive } from "../reactive";
import { effect, stop } from "../effect";
import { describe, it, expect, vi } from "vitest";

// pnpm test ./packages/vue-reactivity/tests/effect.spec.ts -t "^test$"
describe("effect" /** 测试套件名 */, () => {
  it(/* .skip 跳过测试 */ "test" /* 测试用例名 */, () => {
    // get 时收集依赖
    // set 时触发更新
    const user /* 代理对象 */ = reactive({
      age: 10,
    });
    let nextAge = 0;
    effect(() => {
      // console.log("effect");
      nextAge = user.age /* get */ + 1;
    });
    expect(nextAge).toBe(11);
    //! Update
    user.age++; // get, set
    expect(nextAge).toBe(12);
  } /* 测试函数 */);

  //! pnpm test effect
  it("test2", () => {
    let cnt = 10;
    const runner = effect(() => {
      cnt++;
      return "returnValue";
    });
    expect(cnt).toBe(11);
    const ret = runner();
    expect(cnt).toBe(12);
    expect(ret).toBe("returnValue");
  });

  it("scheduler", () => {
    let dummy;
    let run: any;
    const scheduler = vi.fn(() => {
      run = runner;
    });
    const obj = reactive({ foo: 1 });

    const fn = () => {
      dummy = obj.foo;
    };
    const runner = effect(fn, { scheduler });
    // fn 会执行一次

    // set 响应式对象 obj 时 (obj,foo++), 不会执行 fn, 而是执行 scheduler
    // 执行 runner 时，会再次执行 fn
    expect(scheduler).not.toHaveBeenCalled();
    expect(dummy).toBe(1);
    obj.foo++;
    expect(scheduler).toHaveBeenCalled();
    expect(dummy).toBe(1);
    run();
    expect(dummy).toBe(2);
  });

  it("stop", () => {
    let dummy;
    const obj = reactive({ foo: 1 });
    const runner = effect(() => {
      dummy = obj.foo;
    });
    obj.foo = 2;
    expect(dummy).toBe(2);
    stop(runner);
    // obj.foo = 3;
    obj.foo++;
    // 等价于 obj.foo = obj.foo + 1
    // obj.foo++ 时, 有 get 操作, 重新收集依赖
    expect(dummy).toBe(2);
    runner();
    expect(dummy).toBe(3);
  });

  it("onStop", () => {
    const obj = reactive({ foo: 1 });
    const onStop = vi.fn();
    let dummy;
    const runner = effect(
      () => {
        dummy = obj.foo;
      },
      { onStop },
    );
    stop(runner);
    expect(onStop).toHaveBeenCalled();
    expect(dummy).toBe(1);
  });
});
