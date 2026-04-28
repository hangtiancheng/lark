import { type UnwrapRef } from "@vue/reactivity";
import { useSetup } from "./use-setup.js";
import { type ReactElement } from "react";

export function defineComponent<
  PropsType = Record<string, unknown>,
  State = Record<string, unknown>,
>(
  setupFunction: (props: PropsType) => State,
  renderFunction: (state: UnwrapRef<State>) => ReactElement,
): (props: PropsType) => ReactElement {
  return (props: PropsType) => {
    const state = useSetup(setupFunction, props);
    return renderFunction(state as UnwrapRef<State>);
  };
}
