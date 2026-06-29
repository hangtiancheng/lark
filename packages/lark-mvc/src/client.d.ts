/**
 * Ambient type declarations for Lark MVC's DOM and module augmentations.
 *
 * Lark attaches metadata to DOM elements (frame references, compare-key
 * caches, range-event tags) and relies on the `import.meta.hot` HMR context.
 * This file declares those augmentations so application TypeScript code can
 * access them without `as any` casts.
 *
 * Also declares module types for `*.html` (compiled template functions) and
 * `*.css` imports so bundlers resolve them correctly.
 */
import type {
  FrameApi,
  FrameworkApi,
  StateApi,
  RouterApi,
  ViewTemplate,
  VDomTemplate,
} from "./types";
import type { Frame } from "./frame";
import type { View } from "./view";
declare global {
  /** Scheduler API (Chrome 94+) — used by `Framework.task` for time-slicing. */
  var scheduler: Scheduler;
  var __LARK_HMR__: {
    hotSwapByTemplate: (oldTemplate: ViewTemplate, newTemplate: ViewTemplate) => boolean;
    hotSwapByView: (oldSetup: ViewSetup, newSetup: ViewSetup) => boolean;
  };

  interface ImportMeta {
    /** HMR context provided by Vite / webpack dev server. Undefined in production. */
    hot?: {
      accept(cb?: (mod: { default?: unknown } | undefined) => void): void;
      dispose(cb: (data: unknown) => void): void;
      invalidate(): void;
    };
  }
  interface HTMLElement {
    /** Bound frame instance (set by `createFrame` when the element hosts a Frame) */
    frame?: FrameApi | undefined;
    /** Whether a frame is bound to this element (1 = bound, 0 = unbound) */
    frameBound?: number;
    /** Whether an auto-generated ID was assigned by `ensureElementId` */
    autoId?: number;
    /** View rendered flag — used by selector matching during event delegation */
    viewRendered?: number;
    /** Range frame ID — identifies the Frame owning a range-event boundary */
    rangeFrameId?: string;
    /** Range element GUID — unique numeric tag for range-event tracking */
    rangeElementGuid?: number;
  }

  interface Element {
    /** DOM diff cache flag — 1 when `cachedCompareKey` is valid */
    compareKeyCached?: number | undefined;
    /** Cached compare key (from `id`, `#`, or `v-lark` path) for keyed diff */
    cachedCompareKey?: string | undefined;
    /** `v-lark` attribute — declares a child view embedding point */
    "v-lark"?: string | undefined;

    // @lark.js/sentry — declarative tracking attributes (read by the sentry SDK)
    /** Sentry event name for declarative click tracking */
    "s-lark-ev"?: string | undefined;
    /** Sentry message for declarative error reporting */
    "s-lark-msg"?: string | undefined;
  }
}

// CSS module type declarations
declare module "*.css" {
  const content: string;
  export default content;
}

declare module "*.html" {
  const template: ViewTemplate | VDomTemplate;
  export default template;
}
