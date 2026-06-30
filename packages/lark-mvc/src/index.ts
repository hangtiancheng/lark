/**
 * Lark Framework — public API barrel export.
 *
 * Re-exports the complete public surface of `@lark.js/mvc` from a single
 * entry point. Consumers can `import { defineView, Framework, State, ... }`
 * from `"@lark.js/mvc"` without knowing the internal module layout.
 *
 * ## API surface
 *
 * | Category | Exports |
 * | -------- | ------- |
 * | Constants | `SPLITTER`, `LARK_VIEW`, `EVENT_METHOD_REGEXP`, `RouterEvents`, `nextCounter` |
 * | Framework | `Framework`, `defineView`, `createEmitter`, `createCache`, `createUpdater` |
 * | State | `State`, `createStore`, `computed`, `bindStore`, `useUrlState` |
 * | Router | `Router`, `markRouterBooted`, `getRouteMode` |
 * | View | `defineView`, `ViewCtx`, `useState`, `useEffect`, `useStore`, ... |
 * | Frame | `Frame`, `createFrame`, `registerViewClass`, `invalidateViewClass` |
 * | Service | `createService`, `createPayload`, `ServiceApi`, `PayloadApi` |
 * | HMR | `hotSwapByView`, `hotSwapByTemplate`, `acceptView`, `disposeView`, ... |
 * | VDOM | `vdomCreate`, `createVDomRef` |
 */

// Constants
export {
  SPLITTER,
  LARK_VIEW,
  TAG_NAME_REGEXP,
  CALL_BREAK_TIME,
  EVENT_METHOD_REGEXP,
  VIEW_EVENT_METHOD_REGEXP,
  RouterEvents as ROUTER_EVENTS,
  nextCounter,
} from "./common";

// Mark / Unmark (async callback validity tracking)
export { mark, unmark } from "./mark";

// Cache (LFU-style with frequency eviction — functional factory)
export { createCache } from "./cache";
export type { CacheApi } from "./types";

// EventEmitter (multi-cast events — functional factory)
export { createEmitter } from "./event-emitter";
export type { EmitterApi } from "./types";

// State (cross-view observable data)
export { State, markBooted } from "./state";

// Router (history/hash with two-phase change)
export { Router, markRouterBooted, getRouteMode } from "./router";

// Frame (view lifecycle management — functional factory + singleton)
export { Frame, createFrame } from "./frame";
export type { FrameApi } from "./frame";
export { registerViewClass, invalidateViewClass } from "./frame";

// Module loader (async view loading via FrameworkConfig.require)
export { config as frameworkConfig, use } from "./module-loader";

// Updater (per-view data binding — functional factory)
export { createUpdater } from "./updater";
export type { UpdaterApi } from "./types";

// ============================== VDOM ==============================

// VDOM engine
export { vdomCreate, createVDomRef } from "./vdom";

// ============================== VDOM ==============================
// View (functional — defineView factory)
// Internal functions (mountCtx, unmountCtx, registerEvents, etc.) are NOT
// re-exported here — they are called by the Frame system internally.
// Tests import them directly from "./view".
export { defineView } from "./view";
export type { ViewCtx, ViewSetup } from "./types";

// Hooks runtime
export {
  useState,
  useEffect,
  useStore,
  useInterval,
  useTimeout,
  useResource,
  useEvent,
} from "./hooks";

// Service + Payload (API request management)
export { createService, createPayload } from "./service";
export type { ServiceApi, ServiceInstance, PayloadApi } from "./service";

// EventDelegator (DOM event delegation)
export { EventDelegator } from "./event-delegator";

// Framework (main entry point)
export { Framework } from "./framework";

// URL state hook (sync view state with URL params)
export { useUrlState } from "./url-state";

// Store (zustand-aligned state management)
export { createStore, computed, bindStore } from "./store";
export type { StoreApi } from "./store";

// HMR (import.meta.hot support)
export { reloadViews, hotSwapView, hotSwapFrames, hotSwapByTemplate, hotSwapByView } from "./hmr";
export {
  injectTemplateHmrSnippet,
  injectViewHmrSnippet,
  importsHtmlTemplate,
} from "./hmr-inject";
export type { HotContext } from "./hmr";
export type { Bundler } from "./hmr-inject";

// Types (re-exported for consumer convenience)
export * from "./types";
