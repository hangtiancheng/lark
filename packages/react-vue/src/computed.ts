import {
  computed as _computed,
  type ComputedRef,
  type WritableComputedOptions,
  type WritableComputedRef,
  type ComputedGetter,
} from "@vue/reactivity";

export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>;
export function computed<T>(
  options: WritableComputedOptions<T>,
): WritableComputedRef<T>;
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
) {
  const c = _computed(getterOrOptions as ComputedGetter<T>);
  return c;
}
