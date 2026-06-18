/**
 * Lark Framework - barrel export.
 * Re-exports public API modules for convenient access.
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

// Apply-style helper
export { applyStyle } from "./apply-style";

// Mark / Unmark (async callback validity tracking)
export { mark, unmark } from "./mark";

// Safeguard (Proxy-based debug protection)
export { safeguard } from "./safeguard";

// Cache (LFU-style with frequency eviction)
export { Cache } from "./cache";

// EventEmitter (multi-cast events)
export { EventEmitter } from "./event-emitter";

// State (cross-view observable data)
export { State, markBooted } from "./state";

// Router (history/hash with two-phase change)
export { Router, markRouterBooted, getRouteMode } from "./router";

// Frame (view lifecycle management)
export { Frame, registerViewClass, invalidateViewClass } from "./frame";

// Module loader (async view loading via FrameworkConfig.require)
export { config as frameworkConfig, use } from "./module-loader";

// CrossSite (micro-frontend bridge View)
export { default as CrossSite, resetProjectsMap } from "./cross-site";

// Updater (per-view data binding)
export { Updater } from "./updater";

// ============================== VDOM ==============================

// VDOM engine
export { vdomCreate, createVDomRef } from "./vdom";

// ============================== VDOM ==============================

// View (base view class with extend/merge) + typed factory
export { View, defineView } from "./view";

// Service + Payload (API request management)
export { Service, Payload } from "./service";

// EventDelegator (DOM event delegation)
export { EventDelegator } from "./event-delegator";

// Framework (main entry point)
export { Framework } from "./framework";

// URL state hook (sync view state with URL params)
export { useUrlState } from "./url-state";

// Store (zustand-aligned state management)
export { create, computed, bindStore } from "./store";
export type { StoreApi } from "./store";

// Types (re-exported for consumer convenience)
export * from "./types";
