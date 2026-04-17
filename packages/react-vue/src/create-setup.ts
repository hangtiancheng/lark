import { type UnwrapRef } from "@vue/reactivity";
import { useSetup } from "./use-setup.js";

export function createSetup<
  State = Record<string, unknown>,
  PropsType = Record<string, unknown>,
>(setupFunction: (props: PropsType) => State) {
  return (props: PropsType): UnwrapRef<State> => useSetup(setupFunction, props);
}
