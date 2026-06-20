import type {
  FrameInterface,
  FrameworkInterface,
  StateInterface,
  RouterInterface,
  CrossSiteConfig,
} from "./types";
import type { Frame } from "./frame";
import type { View } from "./view";
declare global {
  interface Window {
    /** Lark Framework object */
    __lark_Framework?: FrameworkInterface;
    /** Lark State object */
    __lark_State?: StateInterface;
    /** Lark Router object */
    __lark_Router?: RouterInterface;
    /** Lark Frame class */
    __lark_Frame?: typeof Frame;
    /** Lark View class */
    __lark_View?: typeof View;
    /** Invalidate a view class from the registry (HMR support) */
    __lark_invalidateViewClass?: (viewPath: string) => void;
    /** Get the view class registry (HMR/debug support) */
    __lark_getViewClassRegistry?: () => Record<string, typeof View>;
    /** Register a view class (HMR support) */
    __lark_registerViewClass?: (
      viewPath: string,
      ViewClass: typeof View,
    ) => void;
    /** Cross-site configuration injected by build tools */
    crossConfigs?: CrossSiteConfig[];
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
    frame?: FrameInterface | undefined;
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

// HTML template module declarations (Lark templates - compiled to functions)
declare module "*.html" {
  // const template: (
  //   data: unknown,
  //   viewId: string,
  //   refData: unknown,
  // ) => string;
  // export default template;
  const content: string;
  export default content;
}
