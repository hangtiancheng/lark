import { type Ref, ref, effectScope } from "@vue/reactivity";
import { invokeLifeCycle } from "./lifecycle.js";
import {
  type InstanceStateMap,
  type InternalInstanceState,
  LifecycleHooks,
} from "./types.js";

/**
 * When `react-vue` dependency gets updated during development
 * your build tool re-executes it and `_vueState` becomes its
 * initial state. Storing our reactive effects in `window.__react_vue_state`
 * and filling our `_vueState` with it.
 */
declare global {
  interface Window {
    __react_vue_state: InstanceStateMap;
    __react_vue_id: number;
  }
}

let _id = (__DEV__ && __BROWSER__ && window.__react_vue_id) || 0;
const _vueState: InstanceStateMap =
  (__DEV__ && __BROWSER__ && window.__react_vue_state) || {};
if (__DEV__ && __BROWSER__) window.__react_vue_state = _vueState;

export let currentInstance: InternalInstanceState | null = null;
export let currentInstanceId: number | null = null;

export const getNewInstanceId = () => {
  _id++;

  if (__DEV__ && __BROWSER__) window.__react_vue_id = _id;

  return _id;
};

export const getCurrentInstance = () => currentInstance;
export const setCurrentInstance = (instance: InternalInstanceState | null) => {
  currentInstance = instance;
};

export const setCurrentInstanceId = (id: number | null) => {
  currentInstanceId = id;
  currentInstance = id != null ? _vueState[id] || null : null;
  return currentInstance;
};
export const createNewInstanceWithId = (
  id: number,
  props: Record<string, unknown>,
  data: Ref<unknown> = ref(null),
) => {
  const instance: InternalInstanceState = {
    _id: id,
    props,
    data,
    isMounted: false,
    isUnmounted: false,
    isUnmounting: false,
    hooks: {},
    initialState: {},
    provides: __BROWSER__ ? { ...window.__react_vue_context?.provides } : {},
    scope: effectScope(),
  };
  _vueState[id] = instance;

  return instance;
};

export const runInInstanceScope = (
  id: number,
  cb: (instance: InternalInstanceState | null) => void,
) => {
  const prev = currentInstanceId;
  const instance = setCurrentInstanceId(id);
  if (!instance?.isUnmounted) instance?.scope?.run(() => cb(instance));
  setCurrentInstanceId(prev);
};

const unmount = (id: number) => {
  invokeLifeCycle(LifecycleHooks.BEFORE_UNMOUNT, _vueState[id]);

  // unregister all the computed/watch effects
  for (const effect of _vueState[id].effects || []) {
    effect.stop();
  }

  invokeLifeCycle(LifecycleHooks.UNMOUNTED, _vueState[id]);
  if (_vueState[id].scope) _vueState[id].scope.stop();
  _vueState[id].isUnmounted = true;

  // release the ref
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete _vueState[id as keyof typeof _vueState];
};

export const unmountInstance = (id: number) => {
  if (!_vueState[id]) return;

  _vueState[id].isUnmounting = true;

  /**
   * Postpone unmounting on dev. So we can check setup values
   * in useSetup.ts after hmr updates. That will not be an issue
   * for really unmounting components. Because they are increasing
   * instance id unlike the hmr updated components.
   */
  if (__DEV__) setTimeout(() => _vueState[id]?.isUnmounting && unmount(id), 0);
  else unmount(id);
};

// record effects created during a component's setup() so that they can be
// stopped when the component unmounts
export function recordInstanceBoundEffect(effect: {
  active?: boolean;
  stop: () => void;
}) {
  if (currentInstance) {
    if (!currentInstance.effects) currentInstance.effects = [];
    currentInstance.effects.push(effect);
  }
}
