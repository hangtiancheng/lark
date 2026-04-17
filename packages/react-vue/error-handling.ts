import { isFunction, isPromise } from "@vue/shared";
import { type InternalInstanceState } from "./src/types.js";

export function callWithErrorHandling(
  fn: (...args: unknown[]) => unknown,
  instance: InternalInstanceState | null,
  type: string,
  args?: unknown[],
) {
  let res;
  try {
    res = args ? fn(...args) : fn();
  } catch (err) {
    handleError(err, instance, type);
  }
  return res;
}

type AnyFunction = (...args: unknown[]) => unknown;

export function callWithAsyncErrorHandling(
  fn: AnyFunction | AnyFunction[],
  instance: InternalInstanceState | null,
  type: string,
  args?: unknown[],
): unknown[] {
  if (isFunction(fn)) {
    const res = callWithErrorHandling(fn as AnyFunction, instance, type, args);
    if (res && isPromise(res)) {
      res.catch((err) => {
        handleError(err, instance, type);
      });
    }
    return res as unknown as unknown[];
  }

  const values = [];
  for (const f of fn) {
    values.push(callWithAsyncErrorHandling(f, instance, type, args));
  }

  return values;
}

export function handleError(
  err: unknown,
  instance: InternalInstanceState | null,
  type: string,
) {
  console.error(new Error(`[react-vue:${instance}]: ${type}`));
  console.error(err);
}

export function raise(message: string): never {
  throw createError(message);
}

export function warn(message: string) {
  console.warn(createError(message));
}

export function createError(message: string) {
  return new Error(`[react-vue]: ${message}`);
}
