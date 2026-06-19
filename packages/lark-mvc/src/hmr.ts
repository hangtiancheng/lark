/**
 * HMR (Hot Module Replacement) support for lark-mvc views.
 *
 * Provides standard `import.meta.hot` ESM HMR integration.
 * When a view module (or its imported .html template) changes:
 * 1. Old View class is invalidated in the registry (via dispose)
 * 2. New View class is registered and all mounted frames are re-mounted (via accept)
 *
 * Usage in view files:
 * ```ts
 * import { defineView } from '@lark.js/mvc';
 * import template from './home.html';
 *
 * const HomeView = defineView({ template, ... });
 *
 * if (import.meta.hot) {
 *   HomeView.dispose(import.meta.hot, 'home');
 *   HomeView.accept(import.meta.hot, 'home');
 * }
 *
 * export default HomeView;
 * ```
 *
 * The View class exposes `static accept()` and `static dispose()` methods
 * that delegate to this module. `defineView()` subclasses inherit them
 * automatically via the prototype chain.
 */
import { parseUri } from "./utils";
import {
  invalidateViewClass,
  registerViewClass,
} from "./view-registry";
import { Frame } from "./frame";
import type { View } from "./view";

// ============================================================
// HotContext — minimal interface compatible with Vite and webpack
// ============================================================

/**
 * Minimal HMR context interface.
 * Compatible with Vite's `import.meta.hot` and webpack's `module.hot`.
 * Defined here to avoid depending on bundler-specific type packages.
 */
export interface HotContext {
  /** Accept a self-update. The callback receives the new module namespace. */
  accept(cb?: (mod: { default?: unknown } | undefined) => void): void;
  /** Register a cleanup callback that runs before this module is replaced. */
  dispose(cb: (data: unknown) => void): void;
  /** Force a full page reload (fallback when HMR cannot handle the update). */
  invalidate(): void;
}

// ============================================================
// reloadViews — find and re-mount all frames using a viewPath
// ============================================================

/**
 * Find all currently mounted frames whose viewPath matches the given path,
 * and re-mount them.
 *
 * After a new View class is registered via `registerViewClass`, calling this
 * function triggers `frame.mountView()` on each matching frame. Since the new
 * class is already in the registry, `Frame.mountView` takes the synchronous
 * path (`getViewClass` returns the class immediately).
 *
 * @param viewPath - The view path to match (e.g. 'home', 'components/list')
 */
export function reloadViews(viewPath: string): void {
  const allFrames = Frame.getAll();
  const toReload: Array<{ frame: Frame; fullPath: string }> = [];

  for (const [, frame] of allFrames) {
    if (frame.viewPath) {
      const parsed = parseUri(frame.viewPath);
      if (parsed.path === viewPath) {
        toReload.push({ frame, fullPath: frame.viewPath });
      }
    }
  }

  for (const { frame, fullPath } of toReload) {
    frame.mountView(fullPath);
  }
}

// ============================================================
// acceptView — View.accept() implementation
// ============================================================

/**
 * Set up the HMR accept handler for a view module.
 *
 * When the module is updated:
 * 1. Extracts the new View class from the new module (default export or module itself)
 * 2. Registers the new class in the view registry
 * 3. Re-mounts all frames currently using this viewPath
 *
 * If the new module doesn't export a valid View class, falls back to
 * `hot.invalidate()` which triggers a full page reload.
 *
 * @param hot - The HMR context (import.meta.hot)
 * @param viewPath - The view path identifier (e.g. 'home')
 */
export function acceptView(hot: HotContext, viewPath: string): void {
  hot.accept((newModule) => {
    // Extract View class: prefer default export, fall back to module itself
    const candidate = newModule?.default ?? newModule;

    if (typeof candidate === "function") {
      const NewViewClass = candidate as typeof View;
      registerViewClass(viewPath, NewViewClass);
      reloadViews(viewPath);
    } else {
      // New module didn't export a View class — cannot handle this update
      hot.invalidate();
    }
  });
}

// ============================================================
// disposeView — View.dispose() implementation
// ============================================================

/**
 * Set up the HMR dispose handler for a view module.
 *
 * When the module is about to be replaced, removes the old View class
 * from the registry so that subsequent `getViewClass` calls don't return
 * the stale class.
 *
 * @param hot - The HMR context (import.meta.hot)
 * @param viewPath - The view path identifier (e.g. 'home')
 */
export function disposeView(hot: HotContext, viewPath: string): void {
  hot.dispose(() => {
    invalidateViewClass(viewPath);
  });
}
