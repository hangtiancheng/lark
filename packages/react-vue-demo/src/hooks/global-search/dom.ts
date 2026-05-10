import {
  createSetup,
  onMounted,
  onUnmounted,
  shallowRef,
  watch,
} from "@lark/react-vue";
import type { ValueRef } from "@/types";

interface IProps {
  isOpen: boolean | ValueRef<boolean>;
}

export function setupGlobalSearchDom(props: IProps) {
  const rootElement = shallowRef<HTMLDivElement | null>(null);
  const inputElement = shallowRef<HTMLInputElement | null>(null);
  let focusTimer: number | null = null;

  function setRootElement(element: HTMLDivElement | null) {
    rootElement.value = element;
  }

  function setInputElement(element: HTMLInputElement | null) {
    inputElement.value = element;
  }

  watch(
    () =>
      typeof props.isOpen === "boolean" ? props.isOpen : props.isOpen.value,
    (isOpen) => {
      if (!isOpen) return;

      if (focusTimer) window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        inputElement.value?.focus();
      }, 80);
    },
  );

  function handlePointerDown(event: PointerEvent) {
    if (!(event.target instanceof Node)) return;
    if (rootElement.value?.contains(event.target)) return;

    inputElement.value?.blur();
  }

  onMounted(() => {
    document.addEventListener("pointerdown", handlePointerDown);
  });

  onUnmounted(() => {
    document.removeEventListener("pointerdown", handlePointerDown);
    if (focusTimer) window.clearTimeout(focusTimer);
  });

  return {
    setRootElement,
    setInputElement,
  };
}

export const useGlobalSearchDom = createSetup(setupGlobalSearchDom);
