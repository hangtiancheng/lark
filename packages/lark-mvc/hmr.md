# hmr

## Vite

### HMR API

:::tip Note
This is the client HMR API. For handling HMR update in plugins, see [handleHotUpdate](./api-plugin#handlehotupdate).

The manual HMR API is primarily intended for framework and tooling authors. As an end user, HMR is likely already handled for you in the framework specific starter templates.
:::

Vite exposes its manual HMR API via the special `import.meta.hot` object:

```ts twoslash
import type { ModuleNamespace } from "vite/types/hot.d.ts";
import type {
  CustomEventName,
  InferCustomEventPayload,
} from "vite/types/customEvent.d.ts";

// ---cut---
interface ImportMeta {
  readonly hot?: ViteHotContext;
}

interface ViteHotContext {
  readonly data: any;

  accept(): void;
  accept(cb: (mod: ModuleNamespace | undefined) => void): void;
  accept(dep: string, cb: (mod: ModuleNamespace | undefined) => void): void;
  accept(
    deps: readonly string[],
    cb: (mods: Array<ModuleNamespace | undefined>) => void,
  ): void;

  dispose(cb: (data: any) => void): void;
  prune(cb: (data: any) => void): void;
  invalidate(message?: string): void;

  on<T extends CustomEventName>(
    event: T,
    cb: (payload: InferCustomEventPayload<T>) => void,
  ): void;
  off<T extends CustomEventName>(
    event: T,
    cb: (payload: InferCustomEventPayload<T>) => void,
  ): void;
  send<T extends CustomEventName>(
    event: T,
    data?: InferCustomEventPayload<T>,
  ): void;
}
```

### Required Conditional Guard

First of all, make sure to guard all HMR API usage with a conditional block so that the code can be tree-shaken in production:

```js
if (import.meta.hot) {
  // HMR code
}
```

### IntelliSense for TypeScript

Vite provides type definitions for `import.meta.hot` in [`vite/client.d.ts`](https://github.com/vitejs/vite/blob/main/packages/vite/client.d.ts). You can add "vite/client" in the `tsconfig.json` so TypeScript picks up the type definitions:

```json [tsconfig.json]
{
  "compilerOptions": {
    "types": ["vite/client"]
  }
}
```

### `hot.accept(cb)`

For a module to self-accept, use `import.meta.hot.accept` with a callback which receives the updated module:

```js twoslash
import "vite/client";
// ---cut---
export const count = 1;

if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    if (newModule) {
      // newModule is undefined when SyntaxError happened
      console.log("updated: count is now ", newModule.count);
    }
  });
}
```

A module that "accepts" hot updates is considered an **HMR boundary**.

```dot
digraph hmr_boundary {
  rankdir=RL
  ranksep=0.3
  node [shape=box style="rounded,filled" fontname="Arial" fontsize=11 margin="0.2,0.1" fontcolor="${#3c3c43|#ffffff}" color="${#c2c2c4|#3c3f44}"]
  edge [color="${#67676c|#98989f}" fontname="Arial" fontsize=10 fontcolor="${#67676c|#98989f}"]
  bgcolor="transparent"

  root [label="main.js" fillcolor="${#f6f6f7|#2e2e32}"]
  parent [label="App.vue" fillcolor="${#f6f6f7|#2e2e32}"]
  boundary [label="Component.vue\n(HMR boundary)\nhot.accept()" fillcolor="${#def5ed|#15312d}" color="${#18794e|#3dd68c}" penwidth=2]
  edited [label="utils.js\n(edited)" fillcolor="${#fcf4dc|#38301a}" color="${#915930|#f9b44e}" penwidth=2]

  boundary -> edited [label="imports" color="${#915930|#f9b44e}" style=bold]
  parent -> boundary [label="imports" style=dashed]
  root -> parent [label="imports" style=dashed]
}
```

Vite's HMR does not actually swap the originally imported module: if an HMR boundary module re-exports imports from a dep, then it is responsible for updating those re-exports (and these exports must be using `let`). In addition, importers up the chain from the boundary module will not be notified of the change. This simplified HMR implementation is sufficient for most dev use cases, while allowing us to skip the expensive work of generating proxy modules.

Vite requires that the call to this function appears as `import.meta.hot.accept(` (whitespace-sensitive) in the source code in order for the module to accept update. This is a requirement of the static analysis that Vite does to enable HMR support for a module.

### `hot.accept(deps, cb)`

A module can also accept updates from direct dependencies without reloading itself:

```js twoslash
// @filename: /foo.d.ts
export declare const foo: () => void

// @filename: /example.js
import 'vite/client'
// ---cut---
import { foo } from './foo.js'

foo()

if (import.meta.hot) {
  import.meta.hot.accept('./foo.js', (newFoo) => {
    // the callback receives the updated './foo.js' module
    newFoo?.foo()
  })

  // Can also accept an array of dep modules:
  import.meta.hot.accept(
    ['./foo.js', './bar.js'],
    ([newFooModule, newBarModule]) => {
      // The callback receives an array where only the updated module is
      // non null. If the update was not successful (syntax error for ex.),
      // the array is empty
    },
  )
}
```

### `hot.dispose(cb)`

A self-accepting module or a module that expects to be accepted by others can use `hot.dispose` to clean-up any persistent side effects created by its updated copy:

```js twoslash
import "vite/client";
// ---cut---
function setupSideEffect() {}

setupSideEffect();

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    // cleanup side effect
  });
}
```

### `hot.prune(cb)`

Register a callback that will call when the module is no longer imported on the page. Compared to `hot.dispose`, this can be used if the source code cleans up side-effects by itself on updates and you only need to clean-up when it's removed from the page. Vite currently uses this for `.css` imports.

```js twoslash
import "vite/client";
// ---cut---
function setupOrReuseSideEffect() {}

setupOrReuseSideEffect();

if (import.meta.hot) {
  import.meta.hot.prune((data) => {
    // cleanup side effect
  });
}
```

### `hot.data`

The `import.meta.hot.data` object is persisted across different instances of the same updated module. It can be used to pass on information from a previous version of the module to the next one.

Note that re-assignment of `data` itself is not supported. Instead, you should mutate properties of the `data` object so information added from other handlers are preserved.

```js twoslash
import "vite/client";
// ---cut---
// ok
import.meta.hot.data.someValue = "hello";

// not supported
import.meta.hot.data = { someValue: "hello" };
```

### `hot.decline()`

This is currently a noop and is there for backward compatibility. This could change in the future if there is a new usage for it. To indicate that the module is not hot-updatable, use `hot.invalidate()`.

### `hot.invalidate(message?: string)`

A self-accepting module may realize during runtime that it can't handle a HMR update, and so the update needs to be forcefully propagated to importers. By calling `import.meta.hot.invalidate()`, the HMR server will invalidate the importers of the caller, as if the caller wasn't self-accepting. This will log a message both in the browser console and in the terminal. You can pass a message to give some context on why the invalidation happened.

Note that you should always call `import.meta.hot.accept` even if you plan to call `invalidate` immediately afterwards, or else the HMR client won't listen for future changes to the self-accepting module. To communicate your intent clearly, we recommend calling `invalidate` within the `accept` callback like so:

```js twoslash
import "vite/client";
// ---cut---
import.meta.hot.accept((module) => {
  // You may use the new module instance to decide whether to invalidate.
  if (cannotHandleUpdate(module)) {
    import.meta.hot.invalidate();
  }
});
```

### `hot.on(event, cb)`

Listen to an HMR event.

The following HMR events are dispatched by Vite automatically:

- `'vite:beforeUpdate'` when an update is about to be applied (e.g. a module will be replaced)
- `'vite:afterUpdate'` when an update has just been applied (e.g. a module has been replaced)
- `'vite:beforeFullReload'` when a full reload is about to occur
- `'vite:beforePrune'` when modules that are no longer needed are about to be pruned
- `'vite:invalidate'` when a module is invalidated with `import.meta.hot.invalidate()`
- `'vite:error'` when an error occurs (e.g. syntax error)
- `'vite:ws:disconnect'` when the WebSocket connection is lost
- `'vite:ws:connect'` when the WebSocket connection is (re-)established

Custom HMR events can also be sent from plugins. See [handleHotUpdate](./api-plugin#handlehotupdate) for more details.

### `hot.off(event, cb)`

Remove callback from the event listeners.

### `hot.send(event, data)`

Send custom events back to Vite's dev server.

If called before connected, the data will be buffered and sent once the connection is established.

See [Client-server Communication](/guide/api-plugin.html#client-server-communication) for more details, including a section on [Typing Custom Events](/guide/api-plugin.html#typescript-for-custom-events).

### Further Reading

If you'd like to learn more about how to use the HMR API and how it works under-the-hood. Check out these resources:

- [Hot Module Replacement is Easy](https://bjornlu.com/blog/hot-module-replacement-is-easy)

## Rsbuild

### How to troubleshoot HMR issues?

There are several possible reasons why HMR may not work. This document covers the most common causes and provides troubleshooting guidance.

Before troubleshooting, it's helpful to understand how HMR works:

:::tip HMR principle

1. The browser establishes a WebSocket connection with the dev server for real-time communication.
2. When the dev server finishes recompiling, it sends a notification to the browser via WebSocket. The browser then sends a `hot-update.(js|json)` request to the dev server to load the newly compiled module.
3. After receiving the new module, React projects use React Refresh (an official React tool) to update components. Other frameworks have similar tools.

:::

After understanding how HMR works, you can follow these troubleshooting steps:

#### 1. Check the WebSocket connection

Open the browser console and check for the presence of the `[HMR] connected.` log.

- If present, the WebSocket connection is working correctly. Continue with the following steps.
- If not present, open the Network panel in Chrome and check the status of the `ws://[host]:[port]/rsbuild-hmr` request. If the request failed, this indicates that HMR failed because the WebSocket connection was not established.

The WebSocket connection can fail for various reasons, such as a network proxy preventing the WebSocket request from reaching the dev server. Check whether the WebSocket request address matches your dev server address. If it doesn't match, configure the WebSocket request address using [dev.client](/config/dev/client.md).

#### 2. Check the hot-update requests

When you modify a module's code and trigger a recompilation, the browser sends several `hot-update.json` and `hot-update.js` requests to the dev server to fetch the updated code.

Try modifying a module and inspect the content of the `hot-update.(js|json)` requests. If the request contains the latest code, the hot update request is working correctly.

If the request content is incorrect, it's likely due to a network proxy. Check whether the `hot-update.(js|json)` request address matches your dev server address. If it doesn't match, adjust the proxy rules to route the `hot-update.(js|json)` requests to the dev server address.

#### 3. Check for other causes

If the above steps don't reveal any issues, other factors may be causing HMR to fail. For example, the code may not meet React's HMR requirements. Refer to the following questions for further troubleshooting.

---

### HMR not working with external React?

To ensure HMR works properly, you need to use the development builds of React and ReactDOM.

If you exclude React via `externals` during bundling, the production build of React is typically injected through a CDN, which can cause HMR to fail.

```js
export default {
  output: {
    externals: {
      react: "React",
      "react-dom": "ReactDOM",
    },
  },
};
```

To solve this problem, reference the React development builds and install React DevTools. Hot reloading will then work properly.

If you're unsure which React build you're using, refer to the [React documentation - Use the Production Build](https://legacy.reactjs.org/docs/optimizing-performance.html#use-the-production-build).

---

### HMR not working with filename hash in development mode?

Typically, filename hashes should only be set in production mode (when `process.env.NODE_ENV === 'production'`).

Setting filename hashes in development mode can cause HMR to fail, especially for CSS files. This is because the hash changes every time the file content changes, preventing tools like [mini-css-extract-plugin](https://npmjs.com/package/mini-css-extract-plugin) from reading the latest file content.

- Correct usage:

```js
export default {
  output: {
    filename: {
      css:
        process.env.NODE_ENV === "production"
          ? "[name].[contenthash:10].css"
          : "[name].css",
    },
  },
};
```

- Incorrect usage:

```js
export default {
  output: {
    filename: {
      css: "[name].[contenthash:10].css",
    },
  },
};
```

---

### HMR not working with HTTPS?

When HTTPS is enabled, the HMR connection may fail due to certificate issues. If you open the console, you'll see an HMR connection failed error.

```
» WebSocket connection to 'wss://localhost:3000/rsbuild-hmr' failed:
[HMR] disconnected. Attempting to reconnect.
```

To solve this problem, click "Advanced" -> "Proceed to \[domain] (unsafe)" in the Chrome warning page.

> Tip: When accessing the page via localhost, the "Your connection is not private" warning may not appear. In that case, access the page via a network domain instead.

## Webpack

Hot Module Replacement (HMR) exchanges, adds, or removes [modules](/concepts/modules/) while an application is running, without a full reload. This can significantly speed up development in a few ways:

- Retain application state which is lost during a full reload.
- Save valuable development time by only updating what's changed.
- Instantly update the browser when modifications are made to CSS/JS in the source code, which is almost comparable to changing styles directly in the browser's dev tools.

### How It Works

Let's go through some different viewpoints to understand exactly how HMR works...

### In the Application

The following steps allow modules to be swapped in and out of an application:

1. The application asks the HMR runtime to check for updates.
2. The runtime asynchronously downloads the updates and notifies the application.
3. The application then asks the runtime to apply the updates.
4. The runtime synchronously applies the updates.

You can set up HMR so that this process happens automatically, or you can choose to require user interaction for updates to occur.

### In the Compiler

In addition to normal assets, the compiler needs to emit an "update" to allow updating from the previous version to the new version. The "update" consists of two parts:

1. The updated [manifest](/concepts/manifest) (JSON)
2. One or more updated chunks (JavaScript)

The manifest contains the new compilation hash and a list of all updated chunks. Each of these chunks contains the new code for all updated modules (or a flag indicating that the module was removed).

The compiler ensures that module IDs and chunk IDs are consistent between these builds. It typically stores these IDs in memory (e.g. with [webpack-dev-server](/configuration/dev-server/)), but it's also possible to store them in a JSON file.

### In a Module

HMR is an opt-in feature that only affects modules containing HMR code. One example would be patching styling through the [`style-loader`](https://github.com/webpack/style-loader). In order for patching to work, the `style-loader` implements the HMR interface; when it receives an update through HMR, it replaces the old styles with the new ones.

Similarly, when implementing the HMR interface in a module, you can describe what should happen when the module is updated. However, in most cases, it's not mandatory to write HMR code in every module. If a module has no HMR handlers, the update bubbles up. This means that a single handler can update a complete module tree. If a single module from the tree is updated, the entire set of dependencies is reloaded.

See the [HMR API page](/api/hot-module-replacement) for details on the `module.hot` interface.

### In the Runtime

Here things get a bit more technical... if you're not interested in the internals, feel free to jump to the [HMR API page](/api/hot-module-replacement) or [HMR guide](/guides/hot-module-replacement).

For the module system runtime, additional code is emitted to track module `parents` and `children`. On the management side, the runtime supports two methods: `check` and `apply`.

A `check` makes an HTTP request to the update manifest. If this request fails, there is no update available. If it succeeds, the list of updated chunks is compared to the list of currently loaded chunks. For each loaded chunk, the corresponding update chunk is downloaded. All module updates are stored in the runtime. When all update chunks have been downloaded and are ready to be applied, the runtime switches into the `ready` state.

The `apply` method flags all updated modules as invalid. For each invalid module, there needs to be an update handler in the module or in its parent(s). Otherwise, the invalid flag bubbles up and invalidates parent(s) as well. Each bubble continues until the app's entry point or a module with an update handler is reached (whichever comes first). If it bubbles up from an entry point, the process fails.

Afterwards, all invalid modules are disposed (via the dispose handler) and unloaded. The current hash is then updated and all `accept` handlers are called. The runtime switches back to the `idle` state and everything continues as normal.

### Get Started

HMR can be used in development as a LiveReload replacement. [webpack-dev-server](/configuration/dev-server/) supports a `hot` mode in which it tries to update with HMR before trying to reload the whole page. See the [Hot Module Replacement guide](/guides/hot-module-replacement) for details.

T> As with many other features, webpack's power lies in its customizability. There are _many_ ways of configuring HMR depending on the needs of a particular project. However, for most purposes, `webpack-dev-server` is a good fit and will allow you to get started with HMR quickly.
