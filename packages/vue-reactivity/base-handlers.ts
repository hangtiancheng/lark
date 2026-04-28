import { isObject } from "@lark/vue-shared";
import { track, trigger } from "./effect";
import { reactive, readonly, ReactiveFlags } from "./reactive";

function createGetter(isReadonly = false, shallow = false) {
  // 拦截 get 操作
  return function get<T extends object>(target: T, key: string): unknown {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly;
    }
    if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly;
    }
    const val = Reflect.get(target, key);
    // todo
    // if (shallow) { return val; }
    if (!shallow && isObject(val)) {
      return isReadonly ? readonly(val) : reactive(val);
    }
    if (!isReadonly) {
      // get 时收集依赖
      track(target, key);
    }
    return val;
  };
}

const mutableGet = createGetter(false);
const readonlyGet = createGetter(true);
const shallowReadonlyGet = createGetter(true, true);

function createSetter(isReadonly = false) {
  // 拦截 set 操作
  return function set<T extends object>(
    target: T,
    key: string,
    value: unknown,
  ): boolean {
    if (isReadonly) {
      console.warn(
        `readonly key=${key.toString()}, value=${JSON.stringify(value)}`,
      );
      return true;
    }
    const ok = Reflect.set(target, key, value);
    // set 时触发更新
    trigger(target, key);
    return ok;
  };
}

const mutableSet = createSetter(false);
const readonlySet = createSetter(true);

export const mutableHandler = {
  get: mutableGet,
  set: mutableSet,
};

export const readonlyHandler = {
  get: readonlyGet,
  set: readonlySet,
};

// export const shallowReadonlyHandler = {
//   get: shallowReadonlyGet,
//   set: readonlySet,
// };

export const shallowReadonlyHandler = Object.assign({}, readonlyHandler, {
  get: shallowReadonlyGet,
});
