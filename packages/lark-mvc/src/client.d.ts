import type {
  FrameApi,
  FrameworkApi,
  StateApi,
  RouterApi,
  CrossSiteConfig,
  ViewTemplate,
  VDomTemplate,
} from "./types";
import type { Frame } from "./frame";
import type { View } from "./view";
declare global {
  interface Window {
    /** Cross-site configuration injected by build tools */
    crossSites?: CrossSiteConfig[];
    scheduler?: Scheduler;
  }
  interface ImportMeta {
    /** HMR context provided by Vite / webpack dev server. Undefined in production. */
    hot?: {
      accept(cb?: (mod: { default?: unknown } | undefined) => void): void;
      dispose(cb: (data: unknown) => void): void;
      invalidate(): void;
    };
  }
  interface HTMLElement {
    /** Bound frame instance */
    frame?: FrameApi | undefined;
    /** Whether frame is bound to this element (1 = bound) */
    frameBound?: number;
    /** Whether auto-generated ID was assigned */
    autoId?: number;
    /** View rendered flag for selector matching */
    viewRendered?: number;
    /** Range frame ID for event delegation */
    rangeFrameId?: string;
    /** Range element guid for event delegation */
    rangeElementGuid?: number;
  }

  interface Element {
    /** DOM diff cached compare key flag */
    compareKeyCached?: number | undefined;
    /** DOM diff cached compare key */
    cachedCompareKey?: string | undefined;
    "v-lark"?: string | undefined;

    // @lark.js/sentry
    "s-lark-ev"?: string | undefined;
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
