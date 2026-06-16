/**
 * Lark Framework - barrel export.
 * Re-exports all public modules for convenient access.
 */

// Core utilities
export {
  noop,
  hasOwnProperty,
  assign,
  keys,
  generateId,
  syncCounter,
  funcWithTry,
  setData,
  translateData,
  getById,
  ensureElementId,
  nodeInside,
  parseUri,
  toUri,
  toMap,
  now,
  isPlainObject,
  isPrimitiveOrFunc,
  isPrimitive,
  getAttribute,
} from "./utils";

// Constants
export {
  SPLITTER,
  LARK_VIEW,
  // LARK_KEYS,
  TAG_NAME_REGEXP,
  CALL_BREAK_TIME,
  EVENT_METHOD_REGEXP,
  VIEW_EVENT_METHOD_REGEXP,
  RouterEvents as ROUTER_EVENTS,
  nextCounter,
} from "./constants";

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

// DOM diff engine
export {
  solidDomUnmountFrames,
  solidDomGetNode,
  solidDomGetCompareKey,
  solidDomSpecialDiff,
  solidDomSetAttributes,
  solidDomSetChildNodes,
  solidDomSetNode,
  createSolidDomRef,
  applySolidDomOps,
  applyIdUpdates,
  encodeHTML,
  encodeSafe,
  encodeURIExtra,
  encodeQ,
} from "./solid-dom";

// Updater (per-view data binding)
export { Updater } from "./updater";

// View (base view class with extend/merge) + typed factory
export { View, defineView } from "./view";

// Service + Payload (API request management)
export { Service, Payload } from "./service";
// export type { ServiceConstructor } from "./service";

// EventDelegator (DOM event delegation)
export { EventDelegator } from "./event-delegator";

// Framework (main entry point)
export { Framework } from "./framework";

// URL state hook (sync view state with URL params)
export { useUrlState } from "./url-state";

// Store (zustand-aligned state management)
export { create, computed, bindStore, defineStore } from "./store";
export type { StoreApi } from "./store";

// Frame Visualizer Bridge (devtools postMessage bridge)
export {
  installFrameVisualizerBridge,
  serializeFrameTree,
  FrameVisualBridge,
} from "./frame-visual";

export type {
  SerializedFrameNode,
  SerializedFrameTree,
  SerializedViewInfo,
} from "./frame-visual";

// Template compiler
// export { compileTemplate, extractGlobalVars } from "./compiler";

// Types (re-exported for consumer convenience)
export * from "./types";
