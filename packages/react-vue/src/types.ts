import { type Ref } from "@vue/reactivity";

export interface EffectScope {
  detached: boolean;
  active: boolean;
  run<T>(fn: () => T): T | undefined;
  stop(fromParent?: boolean): void;
}

export enum LifecycleHooks {
  BEFORE_CREATE = "BeforeCreate",
  CREATED = "Created",
  BEFORE_MOUNT = "BeforeMount",
  MOUNTED = "Mounted",
  BEFORE_UPDATE = "BeforeUpdate",
  UPDATED = "Updated",
  BEFORE_UNMOUNT = "BeforeUnmount",
  UNMOUNTED = "Unmounted",
}

export interface InternalInstanceState {
  _id: number;
  props: Record<string, unknown>;
  data: Ref<unknown>;
  isMounted: boolean;
  isUnmounted: boolean;
  isUnmounting: boolean;
  effects?: { active?: boolean; stop: () => void }[];
  hooks: Record<string, ((...args: unknown[]) => unknown)[]>;
  initialState: Record<string | symbol, unknown>;
  provides: Record<string, unknown>;
  scope: EffectScope | null;
}

export type InstanceStateMap = Record<number, InternalInstanceState>;
