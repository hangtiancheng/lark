/**
 * Hot Module Replacement (HMR) for Lark MVC views.
 *
 * HMR hot-swaps view code without a full page reload, preserving view-local
 * state (counter values, form input, scroll-derived data) across updates.
 *
 * ## Two HMR layers
 *
 * 1. **Template layer** (`.html` changes): `hotSwapByTemplate(old, new)`
 *    finds every mounted view whose template function matches the old
 *    reference, replaces it, and force-renders.
 *
 * 2. **View setup layer** (`.ts` changes): `hotSwapByView(old, new)` updates
 *    the view-registry and calls `hotSwapFrames(viewPath, newSetup)` which
 *    runs `hotSwapView` on every matching frame.
 *
 * ## State preservation strategy
 *
 * `hotSwapView` preserves the entire `ViewCtx` — `updater.data`, `resources`,
 * `emitter`, `signature`, `id`, and `owner` all stay the same. It:
 * 1. Runs old `useEffect` cleanups
 * 2. Unregisters old events
 * 3. Destroys `destroyOnRender` resources
 * 4. Re-runs `newSetup(ctx)` — the same ctx instance
 * 5. Updates template/events/assign from the new descriptor
 * 6. Registers new events
 * 7. Increments signature, fires `render`, destroys transient resources,
 *    and calls `updater.forceDigest()`
 *
 * Because the setup function re-runs against the preserved ctx, any data set
 * via `ctx.updater.set()` in the previous setup survives the swap.
 */
import { parseUri } from "./utils";
import {
  invalidateViewClass,
  registerViewClass,
  getViewClass,
  getViewClassRegistry,
} from "./view-registry";
import { unregisterEvents, registerEvents, destroyAllResources } from "./view";
import { setCurrentCtx } from "./hooks";
import type { ViewSetup, ViewTemplate, FrameObj } from "./types";
import { Frame } from "./frame";

export interface HotContext {
  accept(cb?: (mod: { default?: unknown } | undefined) => void): void;
  dispose(cb: (data: unknown) => void): void;
  invalidate(): void;
}

/**
 * Legacy full-remount HMR: unmounts and re-mounts every frame matching the
 * given view path.
 *
 * This destroys the `ViewCtx` (and all view-local state) before creating a
 * fresh one — state is NOT preserved. Prefer {@link hotSwapFrames} for
 * state-preserving HMR.
 *
 * @param viewPath - The view path (without query params) to reload
 */
export function reloadViews(viewPath: string): void {
  const allFrames = Frame.getAll();
  const toReload: Array<{ frame: FrameObj; fullPath: string }> = [];
  for (const [, frame] of allFrames) {
    const vp = frame.getViewPath();
    if (vp) {
      const parsed = parseUri(vp);
      if (parsed.path === viewPath) {
        toReload.push({ frame, fullPath: vp });
      }
    }
  }
  for (const { frame, fullPath } of toReload) {
    frame.mountView(fullPath);
  }
}

/**
 * Hot-swap a single frame's view setup in place, preserving the `ViewCtx`.
 *
 * This is the building block for state-preserving HMR. The existing ctx is
 * reused — only the setup function, template, events, and assign are
 * replaced. See the module-level docs for the full step-by-step sequence.
 *
 * @param frame - The frame whose view should be hot-swapped
 * @param newSetup - The new view setup function produced by the updated module
 */
export function hotSwapView(frame: FrameObj, newSetup: ViewSetup): void {
  const oldView = frame.view;
  if (!oldView) {
    const vp = frame.getViewPath();
    if (vp) frame.mountView(vp);
    return;
  }
  for (let i = oldView.cleanups.length - 1; i >= 0; i--) {
    oldView.cleanups[i]();
  }
  oldView.cleanups.length = 0;
  unregisterEvents(oldView);
  destroyAllResources(oldView, false);
  // Set currentCtx so hooks inside the new setup can access the ctx
  setCurrentCtx(oldView);
  let descriptor: ReturnType<ViewSetup>;
  try {
    descriptor = newSetup(oldView, undefined);
  } finally {
    setCurrentCtx(null);
  }
  oldView.setTemplate(descriptor.template);
  oldView.setEvents(descriptor.events);
  if (descriptor.assign) oldView.setAssign(descriptor.assign);
  registerEvents(oldView);
  if (oldView.signature.value > 0) {
    oldView.signature.value++;
    oldView.fire("render");
    destroyAllResources(oldView, false);
    oldView.updater.forceDigest();
  }
}

/**
 * Find all mounted frames whose view path matches `viewPath`.
 *
 * @param viewPath - The view path (without query params) to match
 * @returns Array of `{ frame, fullPath }` for each matching frame
 */
function findFramesByViewPath(viewPath: string): Array<{ frame: FrameObj; fullPath: string }> {
  const result: Array<{ frame: FrameObj; fullPath: string }> = [];
  for (const [, frame] of Frame.getAll()) {
    const vp = frame.getViewPath();
    if (vp) {
      const parsed = parseUri(vp);
      if (parsed.path === viewPath) {
        result.push({ frame, fullPath: vp });
      }
    }
  }
  return result;
}

/**
 * Batch hot-swap every frame matching `viewPath` with `newSetup`.
 *
 * Convenience wrapper around {@link hotSwapView} — finds all matching frames
 * via {@link findFramesByViewPath} and applies the new setup to each.
 *
 * @param viewPath - The view path to match against mounted frames
 * @param newSetup - The new view setup function to apply
 */
export function hotSwapFrames(viewPath: string, newSetup: ViewSetup): void {
  const targets = findFramesByViewPath(viewPath);
  for (const { frame } of targets) {
    hotSwapView(frame, newSetup);
  }
}

/**
 * Template-only HMR: find every mounted view whose template function matches
 * `oldTemplate`, replace it with `newTemplate`, and force-render.
 *
 * Event handlers are NOT re-delegated because they live in the `events` map
 * returned by the setup function, not in the template. Only the template
 * function reference is swapped.
 *
 * @param oldTemplate - The previous template function reference
 * @param newTemplate - The new template function reference
 */
export function hotSwapByTemplate(oldTemplate: ViewTemplate, newTemplate: ViewTemplate): void {
  if (!oldTemplate || !newTemplate || oldTemplate === newTemplate) return;
  for (const [, frame] of Frame.getAll()) {
    const view = frame.view;
    if (!view || view.getTemplate() !== oldTemplate) continue;
    view.setTemplate(newTemplate);
    if (view.signature.value > 0) {
      view.signature.value++;
      view.fire("render");
      destroyAllResources(view, false);
      view.updater.forceDigest();
    }
  }
}

/**
 * View setup HMR: update the view-registry and hot-swap every frame using
 * `oldSetup` with `newSetup`.
 *
 * 1. Walk the registry, replacing any entry equal to `oldSetup` with `newSetup`
 * 2. Walk all frames, hot-swapping any whose registry entry now points to
 *    `newSetup`
 *
 * @param oldSetup - The previous setup function reference
 * @param newSetup - The new setup function reference
 */
export function hotSwapByView(oldSetup: ViewSetup, newSetup: ViewSetup): void {
  if (!oldSetup || !newSetup || oldSetup === newSetup) return;
  const reg = getViewClassRegistry();
  for (const path in reg) {
    if (reg[path] === oldSetup) reg[path] = newSetup;
  }
  for (const [, frame] of Frame.getAll()) {
    const view = frame.view;
    const vp = frame.getViewPath();
    if (view && vp) {
      const parsed = parseUri(vp);
      if (reg[parsed.path] === newSetup) {
        hotSwapView(frame, newSetup);
      }
    }
  }
}

/** Type guard: verify a dynamic module export is a ViewSetup function */
function isViewSetup(fn: unknown): fn is ViewSetup {
  return typeof fn === "function";
}

/**
 * Manual HMR accept handler for a view module.
 *
 * Registers an `hot.accept` callback that, when the module updates:
 * 1. Extracts the new setup function from `newModule.default` (Vite) or the
 *    re-executed module (Webpack/Rspack)
 * 2. Registers it via `registerViewClass`
 * 3. Calls `hotSwapFrames(viewPath, newSetup)` to preserve state
 *
 * If neither the new module nor the registry contains a valid setup, calls
 * `hot.invalidate()` to trigger a full page reload.
 *
 * This is a no-op-friendly wrapper — pass `undefined` for `hot` in production
 * and the function does nothing.
 *
 * @param hot - The HMR context (`import.meta.hot` for Vite, `module.hot` for Webpack/Rspack)
 * @param viewPath - The view path this module exports
 */
export function acceptView(hot: HotContext, viewPath: string): void {
  hot.accept((newModule) => {
    const candidate = newModule?.default ?? newModule;
    if (isViewSetup(candidate)) {
      registerViewClass(viewPath, candidate);
      hotSwapFrames(viewPath, candidate);
      return;
    }
    const registered = getViewClass(viewPath);
    if (registered) {
      hotSwapFrames(viewPath, registered);
      return;
    }
    hot.invalidate();
  });
}

/**
 * Manual HMR dispose handler for a view module.
 *
 * Registers a `hot.dispose` callback that removes the view setup from the
 * registry via `invalidateViewClass`. This ensures the old setup is evicted
 * before the new module executes, so the next `accept` loads fresh code.
 *
 * This is a no-op-friendly wrapper — pass `undefined` for `hot` in production
 * and the function does nothing.
 *
 * @param hot - The HMR context
 * @param viewPath - The view path to invalidate
 */
export function disposeView(hot: HotContext, viewPath: string): void {
  hot.dispose(() => {
    invalidateViewClass(viewPath);
  });
}
