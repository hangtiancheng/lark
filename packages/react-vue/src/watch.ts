// ported from https://github.com/vuejs/vue-next/blob/master/packages/runtime-core/src/apiWatch.ts

import {
  type Ref,
  type ComputedRef,
  type ReactiveEffectOptions,
} from "@vue/reactivity";
import {
  watch as _watch,
  watchEffect as _watchEffect,
} from "@vue/runtime-core";

export type WatchEffect = (onCleanup: InvalidateCbRegistrator) => void;

export type WatchSource<T = unknown> = Ref<T> | ComputedRef<T> | (() => T);

export type WatchCallback<V = unknown, OV = unknown> = (
  value: V,
  oldValue: OV,
  onCleanup: InvalidateCbRegistrator,
) => unknown;

export type WatchStopHandle = () => void;

type MapSources<T> = {
  [K in keyof T]: T[K] extends WatchSource<infer V>
    ? V
    : T[K] extends object
      ? T[K]
      : never;
};

type MapOldSources<T, Immediate> = {
  [K in keyof T]: T[K] extends WatchSource<infer V>
    ? Immediate extends true
      ? V | undefined
      : V
    : T[K] extends object
      ? Immediate extends true
        ? T[K] | undefined
        : T[K]
      : never;
};

type InvalidateCbRegistrator = (cb: () => void) => void;

export interface WatchOptionsBase {
  flush?: "pre" | "post" | "sync";
  onTrack?: ReactiveEffectOptions["onTrack"];
  onTrigger?: ReactiveEffectOptions["onTrigger"];
}

export interface WatchOptions<Immediate = boolean> extends WatchOptionsBase {
  immediate?: Immediate;
  deep?: boolean;
}

// Simple effect.
export function watchEffect(
  effect: WatchEffect,
  options?: WatchOptionsBase,
): WatchStopHandle {
  return _watchEffect(
    effect as (...args: unknown[]) => unknown,
    options as Record<string, unknown>,
  );
}

// overload #1: array of multiple sources + cb
// Readonly constraint helps the callback to correctly infer value types based
// on position in the source array. Otherwise the values will get a union type
// of all possible value types.
export function watch<
  T extends readonly (WatchSource<unknown> | object)[],
  Immediate extends Readonly<boolean> = false,
>(
  sources: T,
  cb: WatchCallback<MapSources<T>, MapOldSources<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchStopHandle;

// overload #2: single source + cb
export function watch<T, Immediate extends Readonly<boolean> = false>(
  source: WatchSource<T>,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>,
): WatchStopHandle;

// overload #3: watching reactive object w/ cb
export function watch<
  T extends object,
  Immediate extends Readonly<boolean> = false,
>(
  source: T,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>,
): WatchStopHandle;

// implementation
export function watch<T = unknown>(
  source: WatchSource<T> | WatchSource<T>[],
  cb:
    | WatchCallback<T, unknown>
    | WatchCallback<MapSources<T>, MapOldSources<T, boolean>>,
  options?: WatchOptions,
): WatchStopHandle {
  return _watch(
    source as unknown as WatchSource<unknown>,
    cb as WatchCallback<unknown, unknown>,
    options as Record<string, unknown>,
  );
}
