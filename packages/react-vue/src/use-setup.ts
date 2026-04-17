import {
  type UnwrapRef,
  reactive,
  ref,
  readonly,
  unref,
} from "@vue/reactivity";
import { useState, useEffect, useCallback } from "react";
import {
  getNewInstanceId,
  createNewInstanceWithId,
  runInInstanceScope,
  unmountInstance,
} from "./component.js";
import { watch } from "./watch.js";
import { invokeLifeCycle } from "./lifecycle.js";
import { LifecycleHooks } from "./types.js";
export function useSetup<State, Props>(
  setupFunction: (props: Props) => State,
  ReactProps?: Props,
): UnwrapRef<State> {
  const id = useState(getNewInstanceId)[0];

  const setTick = useState(0)[1];

  const createState = useCallback(() => {
    const props = reactive({ ...(ReactProps || {}) }) as Record<
      string,
      unknown
    >;
    const instance = createNewInstanceWithId(id, props);

    runInInstanceScope(id, () => {
      const setupState = setupFunction(readonly(props) as Props) ?? {};
      const data = ref(setupState);

      invokeLifeCycle(LifecycleHooks.BEFORE_MOUNT);

      instance.data = data;

      if (__DEV__) {
        for (const key of Object.keys(setupState))
          instance.initialState[key] = unref(
            (setupState as Record<string, unknown>)[key],
          );
      }

      watch(
        data,
        () => {
          if (instance.isUnmounting) return;

          runInInstanceScope(id, () => {
            if (instance.isMounted) {
              invokeLifeCycle(LifecycleHooks.BEFORE_UPDATE, instance);
            }
            // trigger React update
            setTick(+new Date());
            if (instance.isMounted) {
              invokeLifeCycle(LifecycleHooks.UPDATED, instance);
            }
          });
        },
        { deep: true, flush: "post" },
      );
    });

    return instance.data.value;
  }, [ReactProps, id, setupFunction]);

  // run setup function
  const [state, setState] = useState(createState);

  // sync props changes
  useEffect(() => {
    if (!ReactProps) return;

    runInInstanceScope(id, (instance) => {
      if (!instance) return;
      const { props } = instance;
      for (const key of Object.keys(ReactProps))
        props[key] = (ReactProps as Record<string, unknown>)[key];
    });
  }, [ReactProps, id]);

  // trigger React re-render on data changes
  useEffect(() => {
    /**
     * Invalidate setup after hmr updates
     */
    if (__DEV__) {
      let isChanged = false;

      runInInstanceScope(id, (instance) => {
        if (!instance) return;

        if (!instance.isUnmounting) return;

        const props = Object.assign({}, ReactProps || {}) as Record<
          string,
          unknown
        >;
        const setup = setupFunction(readonly(props) as Props);

        for (const key of Object.keys(setup as Record<string, unknown>)) {
          if (isChanged) break;

          if (typeof instance.initialState[key] === "function")
            isChanged =
              instance.initialState[key].toString() !==
              (setup as Record<string, unknown>)[key]?.toString();
          else
            isChanged =
              instance.initialState[key] !==
              unref((setup as Record<string, unknown>)[key]);
        }

        instance.isUnmounting = false;
      });

      if (isChanged) setState(createState());
    }

    runInInstanceScope(id, (instance) => {
      if (!instance) return;

      // Avoid repeated execution of onMounted and watch after hmr updates in development mode
      if (instance.isMounted) return;

      instance.isMounted = true;

      invokeLifeCycle(LifecycleHooks.MOUNTED);
    });

    return () => {
      unmountInstance(id);
    };
  }, [ReactProps, createState, id, setTick, setupFunction]);

  return state as UnwrapRef<State>;
}
