declare module "*.css" {
  const content: string;
  export default content;
}

declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

/**
 * Type declarations for Module Federation remote modules.
 * The actual modules are loaded at runtime from lark-demo.
 */

declare module "lark-demo/counter-view" {
  export function mountCounter(container: HTMLElement): () => void;
  export const CounterView: unknown;
  const _default: typeof mountCounter;
  export default _default;
}
