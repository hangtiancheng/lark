/**
 * Lark framework utility functions.
 */

import {
  URL_QUERY_HASH_REGEXP,
  URL_PARAM_REGEXP,
  IS_URL_PARAMS,
  isRefToken,
} from "./common";
import type { AnyFunc, ParsedUri } from "./types";

// ============================================================
// Type guards
// ============================================================

/** Check if value is a plain object (not null, not array, typeof object) */
export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto === null) return true;
  return proto === Object.prototype || proto === null;
}

/** Check if value is primitive or function (not a complex object) */
export function isPrimitiveOrFunc(value: unknown): boolean {
  return !value || (typeof value !== "object" && typeof value !== "function");
}

/** Check if value is primitive (not object, not function) */
export function isPrimitive(value: unknown): boolean {
  return !value || typeof value !== "object";
}

// ============================================================
// ID generation
// ============================================================

/** Generate a unique ID with optional prefix */
let _localCounter = 0;
export function generateId(prefix?: string): string {
  return (prefix || "lark_") + _localCounter++;
}

/** Sync local counter with global counter */
export function syncCounter(val: number): void {
  _localCounter = val;
}

export function noop(): void {
  /** noop */
}

// ============================================================
// Object utilities
// ============================================================

/** Safe hasOwnProperty check */
export function hasOwnProperty<T extends object>(
  owner: T | undefined | null,
  prop: PropertyKey,
): boolean {
  return owner != null && Object.prototype.hasOwnProperty.call(owner, prop);
}

/** Get object keys (own enumerable) */
export function keys<T extends object>(obj: T): string[] {
  const result: string[] = [];
  for (const p in obj) {
    if (hasOwnProperty(obj, p)) {
      result.push(p);
    }
  }
  return result;
}

/** Assign properties from sources to target (like Object.assign but safer) */
export function assign<T extends object>(
  target: T,
  ...sources: Partial<T>[]
): T {
  for (const source of sources) {
    if (source) {
      for (const p in source) {
        if (hasOwnProperty(source, p)) {
          target[p] = source[p] as T[Extract<keyof T, string>];
        }
      }
    }
  }
  return target;
}

// ============================================================
// Try-execute utilities
// ============================================================

/**
 * Execute functions in try-catch, ignoring errors.
 * Returns the result of the last successfully executed function.
 */
export function funcWithTry(
  fns: AnyFunc | AnyFunc[],
  args: unknown[],
  context: unknown,
  configError?: (e: unknown) => void,
): unknown {
  const fnArray = Array.isArray(fns) ? fns : [fns];
  let ret: unknown;
  for (const fn of fnArray) {
    try {
      ret = fn.apply(context, args);
    } catch (e) {
      configError?.(e);
    }
  }
  return ret;
}

// ============================================================
// Data utilities
// ============================================================

/** Shared empty Set used as default value to avoid per-call allocation. */
export const EMPTY_STRING_SET: ReadonlySet<string> = new Set();

/**
 * Set newData into oldData, tracking changed keys.
 * Returns whether any value changed.
 */
export function setData(
  newData: Record<string, unknown>,
  oldData: Record<string, unknown>,
  changedKeys: Set<string>,
  excludes: ReadonlySet<string>,
): boolean {
  let changed = false;
  for (const p in newData) {
    if (hasOwnProperty(newData, p)) {
      const now = newData[p];
      const old = oldData[p];
      if ((!isPrimitiveOrFunc(now) || old !== now) && !excludes.has(p)) {
        changedKeys.add(p);
        changed = true;
      }
      oldData[p] = now;
    }
  }
  return changed;
}

/**
 * Translate compiled refData references back to their original values.
 *
 * A reference token has the exact shape `SPLITTER + ascii decimal digits`
 * (as emitted by `refFn`). This shape check ensures user data that
 * merely happens to begin with the SPLITTER character is never mistaken
 * for a ref.
 */

export function translateData(data: object, value: unknown): unknown {
  if (isPrimitive(value)) {
    const prop = String(value);
    if (isRefToken(prop) && hasOwnProperty(data, prop)) {
      return (data as Record<string, unknown>)[prop];
    }
    return value;
  }
  if (isPlainObject(value) || Array.isArray(value)) {
    for (const p in value) {
      if (hasOwnProperty(value, p)) {
        const val = value[p as keyof typeof value];
        const newVal = translateData(data, val);
        (value as Record<string, unknown>)[p] = newVal;
      }
    }
    return value;
  }
  return value;
}

// ============================================================
// DOM utilities
// ============================================================

/** Get element by ID, or return the element itself if already an element */
export function getById(id: string | Element | null): Element | null {
  if (!id) return null;
  if (typeof id === "object") return id;
  return document.getElementById(id);
}

/** Get attribute from element safely */
export function getAttribute(element: Element, attr: string): string {
  return Element.prototype.getAttribute.call(element, attr) ?? "";
}

/** Ensure element has an ID, generating one if missing. Returns the ID. */
export function ensureElementId(element: HTMLElement, prefix?: string): string {
  const id = element.getAttribute("id");
  if (id) return id;
  element.autoId = 1;
  const newId = generateId(prefix);
  element.id = newId;
  return newId;
}

/**
 * Check if node A is inside node B (or is the same node).
 * Uses compareDocumentPosition for efficiency.
 */
export function nodeInside(
  a: string | HTMLElement,
  b: string | HTMLElement,
): boolean {
  const aNode = typeof a === "string" ? document.getElementById(a) : a;
  const bNode = typeof b === "string" ? document.getElementById(b) : b;
  if (!aNode || !bNode) return false;
  if (aNode === bNode) return true;
  try {
    return (bNode.compareDocumentPosition(aNode) & 16) === 16;
  } catch {
    return false;
  }
}

// ============================================================
// URI utilities
// ============================================================

/**
 * Parse URI string into path and params object.
 * e.g. "/xxx/?a=b&c=d" => { path: "/xxx/", params: { a: "b", c: "d" } }
 *
 * The accumulator is function-local, so nested / re-entrant calls
 * (e.g. invoking `parseUri` again inside a replace callback) are safe.
 */
export function parseUri(uri: string): ParsedUri {
  const params: Record<string, string> = {};
  const path = uri.replace(URL_QUERY_HASH_REGEXP, "");
  const pathname = path;
  // Check if the original URI looks like it has params (e.g. YT3O0sPH1No= base64)
  const actualPath =
    uri === pathname && IS_URL_PARAMS.test(pathname) ? "" : pathname;
  uri
    .replace(actualPath, "")
    .replace(URL_PARAM_REGEXP, (_match, name: string, value: string) => {
      try {
        params[name] = decodeURIComponent(value || "");
      } catch {
        params[name] = value || "";
      }
      return "";
    });
  return { path: actualPath, params };
}

/**
 * Convert path and params to URI string.
 * e.g. toUri("/xxx/", { a: "b", c: "d" }) => "/xxx/?a=b&c=d"
 */
export function toUri(
  path: string,
  params: Record<string, unknown>,
  keepEmpty?: ReadonlySet<string>,
): string {
  const pairs: string[] = [];
  let hasParams = false;

  for (const p in params) {
    if (hasOwnProperty(params, p)) {
      const v = String(params[p] ?? "");
      if (!keepEmpty || v || keepEmpty.has(p)) {
        pairs.push(`${p}=${encodeURIComponent(v)}`);
        hasParams = true;
      }
    }
  }

  if (hasParams) {
    path += (path && (~path.indexOf("?") ? "&" : "?")) + pairs.join("&");
  }
  return path;
}

/**
 * Convert array to map/hash object.
 * For simple arrays, counts occurrences.
 * For object arrays, uses specified key as map key.
 */
export function toMap<T>(
  list: T[] | null | undefined,
  key?: keyof T,
): Record<string, T | number> {
  const map: Record<string, T | number> = {};
  if (!list) return map;
  for (const item of list) {
    const mapKey = key ? String(item[key]) : String(item);
    map[mapKey] = key ? item : ((map[mapKey] as number) || 0) + 1;
  }
  return map;
}

// ============================================================
// Async utilities
// ============================================================

/** Get current timestamp */
export function now(): number {
  return Date.now ? Date.now() : new Date().getTime();
}
