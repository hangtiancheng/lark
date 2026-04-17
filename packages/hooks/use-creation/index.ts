// readonly unknown[]
import type { DependencyList } from "react";
import { useRef } from "react";
import { depsAreSame } from "../utils/deps-are-same.js";

/**
 *
 * @description 替代 useMemo, useRef
 */
function useCreation<T>(factory: () => T, deps: DependencyList) {
  const { current } = useRef<{
    deps: DependencyList;
    obj: T | undefined;
    initialized: boolean;
  }>({
    deps,
    obj: undefined,
    initialized: false,
  });

  if (!current.initialized || !depsAreSame(current.deps, deps)) {
    current.deps = deps;
    current.obj = factory();
    current.initialized = true;
  }

  return current.obj;
}

export default useCreation;
