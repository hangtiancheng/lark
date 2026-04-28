export { useSetup } from "./use-setup.js";
export { defineComponent } from "./define-component.js";
export { watch, watchEffect } from "./watch.js";
export { computed } from "./computed.js";
export { createSetup } from "./create-setup.js";
export { getCurrentInstance } from "./component.js";
export { nextTick } from "./next-tick.js";
export { warn } from "../error-handling.js";
export * from "./mock.js";
export type { App, Plugin } from "./mock.js";
export {
  onMounted,
  onBeforeMount,
  onUnmounted,
  onUpdated,
  onBeforeUnmount,
  onBeforeUpdate,
} from "./lifecycle.js";
// redirect all APIs from @vue/reactivity
export {
  // computed,
  type ComputedGetter,
  type ComputedRef,
  type ComputedSetter,
  customRef,
  type DebuggerEvent,
  type DeepReadonly,
  effect,
  effectScope,
  getCurrentScope,
  onScopeDispose,
  enableTracking,
  isProxy,
  isReactive,
  isReadonly,
  isRef,
  ITERATE_KEY,
  markRaw,
  pauseTracking,
  reactive,
  type ReactiveEffect,
  type ReactiveEffectOptions,
  type ReactiveFlags,
  readonly,
  ref,
  type Ref,
  type ShallowRef,
  type RefUnwrapBailTypes,
  resetTracking,
  shallowReactive,
  shallowReadonly,
  shallowRef,
  stop,
  toRaw,
  toRef,
  toRefs,
  toValue,
  type ToRefs,
  track,
  TrackOpTypes,
  trigger,
  TriggerOpTypes,
  triggerRef,
  unref,
  type UnwrapRef,
  type WritableComputedOptions,
  type WritableComputedRef,
} from "@vue/reactivity";

export const version = "0.0.1";
export const Fragment = Symbol("Fragment");
export const TransitionGroup = Symbol("TransitionGroup");
export const onActivated = () => {
  // Mock implementation
};
export const onDeactivated = () => {
  // Mock implementation
};
