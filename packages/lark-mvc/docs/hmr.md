# Hot module replacement

Lark MVC ships zero-config hot module replacement (HMR) for Vite, Webpack, and Rspack. When you edit a `.html` template or a `.ts` view file, the framework hot-swaps the changed code in place without a full page reload. View-local state, such as a counter's current value or form input, survives the update.

This document covers how Lark HMR works, how to configure it, how state is preserved, and how to fall back to the manual API for advanced cases.

## How Lark HMR works

Lark HMR has two layers that operate independently. The template layer handles `.html` changes. The view setup layer handles `.ts` changes. Both are auto-injected by the build plugins, so you never write `import.meta.hot` yourself.

### Template layer

When you edit a `.html` template file, the bundler recompiles the template module. The compiled module self-accepts the update. In the accept callback, Lark calls `hotSwapByTemplate(oldTemplate, newTemplate)` to find every mounted view whose `ctx.getTemplate()` returns the old function reference, then replaces it with the new one via `ctx.setTemplate(newTemplate)`.

The swap preserves the view context entirely. The `updater.data` object, captured resources, event subscriptions, and signature all stay intact. Only the template function reference changes. A `forceDigest()` call re-runs the new template against the existing data to produce the updated DOM.

This layer does not re-delegate events. Event handlers live in the `events` map returned by the setup function, not in the template. The `EventDelegator` resolves `@event` handler names at click time by looking up `ctx.getEvents()`, so a template-only change needs no re-binding.

### View setup layer

When you edit a `.ts` view file, the bundler re-executes the module. The auto-injected HMR snippet captures the old setup function via `dispose` and the new setup function via `accept`, then calls `hotSwapByView(oldSetup, newSetup)`.

`hotSwapByView` does two things. First, it updates the view registry: every `viewPath` whose registered setup function matches `oldSetup` is replaced with `newSetup`, so future `mountView` calls use the new setup. Second, it finds every mounted frame whose registered setup matches `oldSetup` and hot-swaps each one in place via `hotSwapView`.

The in-place swap performs these steps in order:

1. **Run old cleanups** — all cleanup functions registered via `useEffect` are called in reverse order, then the `cleanups` array is cleared.
2. **Unregister old events** — `unregisterEvents(oldView)` removes DOM event delegations bound to the old `events` map. Emitter-level subscriptions (e.g. `ctx.on("destroy", ...)`) are preserved because they live on `ctx.emitter`, not in the `events` map.
3. **Destroy render-once resources** — `destroyAllResources(ctx, false)` destroys resources marked `destroyOnRender`, preserving permanent resources.
4. **Re-run setup** — `newSetup(oldView, undefined)` is called with the existing `ViewCtx`. The setup function returns a new `{ template, events, assign }` descriptor. The ctx instance, `updater`, `updater.data`, `resources`, `emitter`, `signature`, `id`, and `owner` all stay the same.
5. **Update descriptor** — `ctx.setTemplate(descriptor.template)`, `ctx.setEvents(descriptor.events)`, `ctx.setAssign(descriptor.assign)` replace the old values.
6. **Register new events** — `registerEvents(ctx)` binds DOM event delegations for the new `events` map.
7. **Force re-render** — increment `ctx.signature.value`, fire the `"render"` event, destroy `destroyOnRender` resources again, and call `ctx.updater.forceDigest()`.

The user's setup function runs again, but because it receives the same `ViewCtx` with preserved `updater.data`, any state set via `ctx.updater.set()` in the previous setup survives. However, any side effects in setup (e.g. `console.log`, `bindStore` re-subscription) will re-execute.

## Zero-config auto-injection

The build plugins inject HMR code at compile time, similar to how `@vitejs/plugin-react` injects React Refresh and `@vitejs/plugin-vue` injects Vue HMR runtime calls. You add the plugin to your config and HMR works. No per-file boilerplate needed.

### Vite

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { larkMvcPlugin } from "@lark.js/mvc/vite";

export default defineConfig({
  plugins: [larkMvcPlugin()],
});
```

The Vite plugin uses two hooks. The `load` hook compiles `.html` templates and appends a template HMR snippet that uses `import.meta.hot`. The `transform` hook processes `.ts` files: if a file imports a `.html` template, it rewrites `export default defineView(...)` into a named const and appends a view setup HMR snippet.

### Webpack

```javascript
// webpack.config.mjs
import { LarkMvcPlugin } from "@lark.js/mvc/webpack";

export default {
  plugins: [new LarkMvcPlugin()],
};
```

The Webpack loader compiles `.html` templates and appends a template HMR snippet that uses `module.hot`. View setup HMR for `.ts` files requires an additional loader configuration and is not auto-registered by the plugin.

### Rspack

```javascript
// rspack.config.mjs
import { LarkMvcPlugin } from "@lark.js/mvc/rspack";

export default {
  plugins: [new LarkMvcPlugin()],
};
```

The Rspack integration mirrors Webpack. The loader returns a Promise directly rather than calling `this.callback()`, which is the Rspack async loader convention.

## Cross-bundler HMR API differences

The three bundlers expose different HMR APIs. Lark generates the correct snippet for each one.

| Bundler | HMR context       | Accept callback receives new module |
| ------- | ----------------- | ----------------------------------- |
| Vite    | `import.meta.hot` | Yes, via `newModule.default`        |
| Webpack | `module.hot`      | No, module already re-executed      |
| Rspack  | `module.hot`      | No, module already re-executed      |

The key difference is the callback scope. In Vite, the accept callback runs in the OLD module's scope, so local variables reference the old values. In Webpack and Rspack, the callback runs in the NEW module's scope because the module has already re-executed, so local variables reference the new values.

Both snippets use the `dispose` callback to save the old reference into `hot.data` before replacement. The accept callback reads it back. This pattern works identically across all three bundlers.

## What gets injected

### Template module snippet

The compiled template module exports a named function `__larkTemplate`. This name is the compile-time contract between `compileTemplate` and the HMR snippet. The snippet captures the old function reference on dispose and compares it against the new one on accept.

For Vite, the injected code looks like this:

```javascript
if (import.meta.hot) {
  import.meta.hot.dispose(function (__larkData) {
    __larkData.oldTemplate = __larkTemplate;
  });
  import.meta.hot.accept(function (__larkNewModule) {
    var __larkNew = __larkNewModule && __larkNewModule.default;
    var __larkOld = import.meta.hot.data.oldTemplate;
    if (__larkOld && __larkNew && __larkOld !== __larkNew) {
      import("@lark.js/mvc").then(function (m) {
        m.hotSwapByTemplate(__larkOld, __larkNew);
      });
    }
  });
}
```

The dynamic `import("@lark.js/mvc")` avoids pulling the framework into the template module's dependency graph at build time. In production builds, the entire `if` block is dead code and gets tree-shaken.

For Webpack and Rspack, the snippet uses `module.hot` and reads the new template from the local `__larkTemplate` variable, which already holds the new function because the module has re-executed.

### View setup module snippet

For `.ts` files that import `.html`, the plugin rewrites the export and appends the snippet:

```typescript
// Before injection:
export default defineView((ctx, params) => { ... });

// After injection:
const __larkViewDefault = defineView((ctx, params) => { ... });
export default __larkViewDefault;

if (import.meta.hot) {
  import.meta.hot.dispose(function(__larkData) {
    __larkData.oldClass = __larkViewDefault;
  });
  import.meta.hot.accept(function(__larkNewModule) {
    var __larkNew = __larkNewModule && __larkNewModule.default;
    var __larkOld = import.meta.hot.data.oldClass;
    if (__larkOld && __larkNew && __larkOld !== __larkNew) {
      import("@lark.js/mvc").then(function(m) {
        m.hotSwapByView(__larkOld, __larkNew);
      });
    }
  });
}
```

The rewrite uses a depth-counting parser to find the end of the `export default` expression, handling nested parens, braces, brackets, strings, templates, and comments. If the file has no `export default` or the expression boundary cannot be determined, the source is returned unchanged.

## State preservation

The core design principle is that HMR never destroys and recreates a `ViewCtx`. The ctx instance identity, along with all its runtime state, stays constant across updates. Only the setup function, template, and events change.

### What is preserved

- **`updater.data`**: all view-local data set via `ctx.updater.set()`. A counter at 42 stays at 42 after a template edit.
- **`updater.refData`**: reference data for template rendering.
- **`resources`**: captured resources via `ctx.capture()`, except those marked `destroyOnRender`.
- **`ctx.emitter` subscriptions**: internal event subscriptions registered via `ctx.on()`, including `"destroy"` and `"render"` listeners. These survive because they live on the emitter, not in the `events` map.
- **`signature`**: the async operation validity counter (`Ref<number>`). Pending `wrapAsync` callbacks remain valid.
- **`locationObserved` and observed state keys**: observation config set via `ctx.observeLocation()` and `ctx.observeState()`.
- **Store subscriptions**: if the view uses `bindStore()`, the subscription's unsubscribe function is registered as a cleanup. During HMR, old cleanups run (unsubscribing), then the new setup re-runs `bindStore()` (re-subscribing). The net effect is the subscription is refreshed with the new setup's selector.

### What is not preserved

- **`destroyOnRender` resources**: these are destroyed on every render, including HMR force-renders, by design.
- **Setup side effects**: since the setup function re-runs, any one-time setup logic (e.g. `console.log`, initial `ctx.updater.set()` calls) will re-execute. If your setup sets initial data unconditionally, it will overwrite HMR-preserved data. Guard with `if (!ctx.rendered.value)` if needed.

### The `forceDigest` method

Normal `digest()` only re-renders when data has changed. After an HMR swap, the data has not changed but the template has. `forceDigest()` solves this by marking every current data key as changed before triggering the digest cycle:

```typescript
function forceDigest(): void {
  hasChangedFlag = 1;
  changedKeys = new Set(Object.keys(data));
  digest();
}
```

This forces the DOM or VDOM diff to re-evaluate every template region, ensuring the new template is fully applied even though the data is identical.

## Manual HMR API

For cases where the auto-injection does not cover your needs, Lark exposes a manual HMR API as module-level functions. This is the original API that predates auto-injection, and it remains useful for custom module structures.

```typescript
import { defineView, acceptView, disposeView } from "@lark.js/mvc";
import type { HotContext } from "@lark.js/mvc";
import template from "./home.html";

const HomeView = defineView((ctx) => ({ template /* ... */ }));

if (import.meta.hot) {
  const hot = import.meta.hot as HotContext;
  disposeView(hot, "home");
  acceptView(hot, "home");
}

export default HomeView;
```

`acceptView(hot, viewPath)` registers an accept callback that extracts the new setup function from the updated module, registers it in the view registry, and calls `hotSwapFrames(viewPath, newSetup)` to hot-swap all matching frames in place.

`disposeView(hot, viewPath)` registers a dispose callback that removes the old setup function from the registry so subsequent lookups do not return the stale function.

Both functions are no-ops when `hot` is `undefined`, so they are safe to call unconditionally in production builds.

## Public API reference

### Runtime functions

All functions are exported from `@lark.js/mvc`.

- **`hotSwapByTemplate(oldTemplate, newTemplate)`**: finds every view whose `ctx.getTemplate()` returns `oldTemplate` and calls `ctx.setTemplate(newTemplate)`, then force-renders. Used by the template HMR snippet.
- **`hotSwapByView(oldSetup, newSetup)`**: updates the registry and hot-swaps every mounted view whose registered setup matches `oldSetup`. Used by the view setup HMR snippet.
- **`hotSwapView(frame, newSetup)`**: hot-swaps a single frame's view in place by re-running setup. The building block for the other hot-swap functions.
- **`hotSwapFrames(viewPath, newSetup)`**: finds all frames matching `viewPath` and calls `hotSwapView` on each. Used by `acceptView`.
- **`reloadViews(viewPath)`**: legacy full-remount. Destroys the old view context and creates a fresh one. Loses all view-local state. Retained for backward compatibility.
- **`acceptView(hot, viewPath)`**: sets up the HMR accept handler for a view module.
- **`disposeView(hot, viewPath)`**: sets up the HMR dispose handler.

### Injection functions

Exported from `@lark.js/mvc` and also available directly from `@lark.js/mvc/hmr-inject`.

- **`injectTemplateHmrSnippet(source, bundler)`**: appends a template HMR snippet to a compiled template module source. The `bundler` parameter selects the HMR API.
- **`injectViewHmr(source, bundler)`**: rewrites `export default` in a `.ts` file and appends a view setup HMR snippet. Returns the source unchanged if the file does not import `.html`.
- **`importsHtmlTemplate(source)`**: returns `true` if the source contains a `.html` import statement. Used by the Vite `transform` hook to decide whether to inject.

### Types

- **`Bundler`**: `"vite" | "webpack" | "rspack"`. Passed to the injection functions.
- **`HotContext`**: minimal interface compatible with Vite's `import.meta.hot` and Webpack's `module.hot`. Has `accept`, `dispose`, and `invalidate` methods.

## Architecture: why hmr-inject is separate from hmr

The injection code generator lives in a separate module (`hmr-inject.ts`) from the runtime HMR functions (`hmr.ts`). This separation is a hard requirement, not a style preference.

The three bundler plugin entry points (`vite.ts`, `webpack.ts`, `rspack.ts`) are loaded in Node.js to process the build config. The runtime module `hmr.ts` imports `./frame`, which imports `./event-delegator`, which accesses `document` at module evaluation time. In Node.js, `document` is undefined, so evaluating `hmr.ts` throws `ReferenceError: document is not defined`.

The injection functions are pure string generators. They have zero runtime imports. By keeping them in `hmr-inject.ts`, the plugin entry points can import them without pulling in the browser-only runtime. The runtime functions are only loaded in the browser, where `document` exists.

## Troubleshooting

### Full page reload instead of HMR

If editing a `.html` or `.ts` file triggers a full page reload instead of a hot update, check that the bundler plugin is registered. For Vite, confirm `larkMvcPlugin()` is in the `plugins` array. For Webpack and Rspack, confirm `new LarkMvcPlugin()` is in the `plugins` array.

For Webpack and Rspack, view setup HMR for `.ts` files is not auto-registered. Only template HMR works out of the box. A `.ts` file change falls back to a full page reload unless you add a loader that calls `injectViewHmr`.

### `ReferenceError: document is not defined`

This error occurs when a Node.js context imports the runtime HMR module. If you are writing a custom plugin or loader that only needs the injection functions, import from `@lark.js/mvc/hmr-inject`, not from `@lark.js/mvc`. The injection module has no runtime dependencies and is safe to load in Node.js.

### State resets after HMR

If view-local state resets to initial values after an HMR update, check whether your setup function unconditionally sets initial data. For example:

```typescript
// This overwrites count on every setup run, including HMR:
export default defineView((ctx) => {
  ctx.updater.set({ count: 0 });
  return { template, events };
});
```

During HMR, the setup function re-runs with the same `ViewCtx`. If it unconditionally calls `ctx.updater.set()`, it overwrites the preserved data. Guard with a check:

```typescript
export default defineView((ctx) => {
  if (!ctx.rendered.value) {
    ctx.updater.set({ count: 0 }); // only on first mount
  }
  return { template, events };
});
```

If you use the manual API with `reloadViews` (the legacy full-remount), state will reset because the view context is destroyed and recreated. Use `hotSwapFrames` or `hotSwapByView` instead.

### HMR does not fire for a specific file

The view setup HMR injection only activates for `.ts` files that import a `.html` template. If your view file does not import `.html` directly, the `importsHtmlTemplate` check returns `false` and the file is left untouched. You can add the manual HMR API to such files as a fallback.
