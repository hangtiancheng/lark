/**
 * HMR (Hot Module Replacement) support for lark-mvc views (functional).
 *
 * HMR works by re-running the setup function rather than swapping prototypes.
 * The ViewCtx is preserved (updater.data, resources, signature, cleanups).
 * No class, no this, no prototype.
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

function findFramesByViewPath(
  viewPath: string,
): Array<{ frame: FrameObj; fullPath: string }> {
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

export function hotSwapFrames(viewPath: string, newSetup: ViewSetup): void {
  const targets = findFramesByViewPath(viewPath);
  for (const { frame } of targets) {
    hotSwapView(frame, newSetup);
  }
}

export function hotSwapByTemplate(
  oldTemplate: ViewTemplate,
  newTemplate: ViewTemplate,
): void {
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

export function disposeView(hot: HotContext, viewPath: string): void {
  hot.dispose(() => {
    invalidateViewClass(viewPath);
  });
}
