# Bug Report: Module Federation Chunks Load from Host Origin in Rsbuild Dev Mode

## Summary

When a Rsbuild dev server acts as a Module Federation **remote** (exposes
modules consumed by a host on a different port), all of the remote's async
chunks are requested from the **host's** dev server origin instead of the
remote's own origin. The host's dev server returns `index.html`
(`historyApiFallback`) for the missing `.js` files, producing:

```
Uncaught SyntaxError: Unexpected token '<'
```

The same MF configuration works correctly under **webpack-dev-server**.

## Environment

| Component                    | Version   |
| ---------------------------- | --------- |
| Rsbuild                      | 2.1.1     |
| Rspack                       | (bundled) |
| `@module-federation/runtime` | 2.6.0     |
| Node.js                      | 24.x      |
| OS                           | macOS     |

## Reproduction

1. Start two Rsbuild dev servers that mutually consume each other's MF
   modules:
   - `lark-demo` (remote, port 3000) — exposes `./counter-view`
   - `lark-devtool` (host, port 5173) — consumes `lark_demo/counter-view`
2. Open `http://localhost:5173/mf-demo` in a browser.
3. Click **"Load Remote View"**.

### Expected

The remote `counter-view` module loads from `http://localhost:3000/` and
mounts successfully.

### Actual

The browser reports `Uncaught SyntaxError: Unexpected token '<'`. The
console shows:

```
Loading chunk view-counter failed.
(missing: http://localhost:5173/static/js/async/js/view-counter.xxx.js)
while loading "./counter-view" from webpack/container/reference/lark_demo
```

Note the origin: **5173** (the host), not 3000 (the remote).

## Root Cause Analysis

### Symptom: chunk URLs use the host origin

Network inspection (via DevTools) reveals that **every** async chunk
belonging to `lark-demo` is requested from `http://localhost:5173/...`:

```
reqid=71 GET http://localhost:5173/static/js/async/js/view-counter.xxx.js   [200, text/html]
reqid=73 GET http://localhost:5173/static/js/async/js/comp-counter-store…   [200, text/html]
```

The host dev server returns `index.html` for these paths (SPA fallback),
which the browser tries to parse as JavaScript → `Unexpected token '<'`.

### Why: `manifest.metaData.publicPath` is the literal string `"auto"`

The generated `remoteEntry.js` embeds a `@module-federation/runtime`
function `generateSnapshotFromManifest(manifest, options)`, which contains
this `getPublicPath` closure:

```js
const getPublicPath = () => {
  if ("publicPath" in manifest.metaData) {
    if (
      (manifest.metaData.publicPath === "auto" ||
        manifest.metaData.publicPath === "") &&
      version
    )
      return inferAutoPublicPath(version);
    return manifest.metaData.publicPath; // ← falls through to here
  } else return manifest.metaData.getPublicPath;
};
```

For the `inferAutoPublicPath(version)` branch to fire, **two** conditions
must hold:

1. `manifest.metaData.publicPath` must be `"auto"` or `""`.
2. The `version` argument must be **truthy**.

`version` comes from `options.version` of `generateSnapshotFromManifest`:

```js
// SnapshotHandler.js (inside @module-federation/runtime-core)
const remoteSnapshot = generateSnapshotFromManifest(manifestJson, {
  version: manifestUrl,
});
```

In dev mode, when the host loads the remote via a webpack-style remote
spec (`lark_demo@http://localhost:3000/remoteEntry.js`), the
`manifestUrl` is **not** propagated into the snapshot generation path.
`version` arrives as `undefined`, the `if (... && version)` guard fails,
and `getPublicPath()` returns the **literal string `"auto"`**.

The browser then resolves the chunk URL
`"auto" + "static/js/async/js/view-counter.xxx.js"` against the
**current document's origin** (the host, `localhost:5173`), producing the
wrong requests.

### Where rspack writes `"auto"` into the manifest

In `rspack/crates/rspack_plugin_mf/src/manifest/mod.rs` (line ~196):

```rust
let public_path = match &compilation.options.output.public_path {
    PublicPath::Auto => Some("auto".to_string()),       // ← serialized verbatim
    PublicPath::Filename(f) => Some(PublicPath::render_filename(compilation, f).await),
};
// ...
let meta = BasicStatsMetaData {
    // ...
    publicPath: public_path,
    // ...
};
```

When `output.publicPath` is `Auto`, rspack serializes the **string
literal `"auto"`** into `manifest.metaData.publicPath`. It does **not**
emit a runtime publicPath-inferral stub (unlike webpack 5).

### Why webpack-dev-server is unaffected

webpack 5's built-in MF runtime infers `publicPath` at runtime via
`__webpack_require__.p` and `document.currentScript.src`. When the host
loads `<script src="http://localhost:3000/remoteEntry.js">`, webpack's
runtime sets `__webpack_require__.p = "http://localhost:3000/"` before
any chunk is requested. No `version` argument or manifest URL is needed.

rspack delegates its MF runtime to `@module-federation/runtime`
(MF 2.0 architecture), which relies on `generateSnapshotFromManifest`
receiving `version: manifestUrl`. When that argument is missing, the
`"auto"` literal survives into the chunk URL base.

## Fix

### Workaround (applied)

Force an **absolute** `output.publicPath` in dev mode on the remote's
rsbuild config, so `manifest.metaData.publicPath` is a concrete origin
rather than `"auto"`:

```ts
// lark-demo/rsbuild.config.ts
const MF_DEV_ORIGIN = "http://localhost:3000/";

export default defineConfig(({ command }) => {
  const isDev = command === "dev";
  return {
    // ...
    tools: {
      rspack(config, { rspack }) {
        config.output = config.output ?? {};
        config.output.publicPath = isDev ? MF_DEV_ORIGIN : "/";
        // ...
      },
    },
    server: {
      port: 3000,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    },
  };
});
```

The same change was applied to `lark-devtool/rsbuild.config.ts`
(`MF_DEV_ORIGIN = "http://localhost:5173/"`) because it also acts as a
remote (exposes `./cdn-manager`).

`rsbuild`'s `output.assetPrefix: "auto"` is **insufficient** — it sets
`rspack.config.output.publicPath` to the string `"auto"`, which rspack
serializes verbatim into the manifest (see root cause above). The fix
must set `config.output.publicPath` to an absolute URL inside the
`tools.rspack` hook.

### Verification

After applying the fix:

1. `hasLocalhost3000` in the generated `remoteEntry.js` becomes `true`
   (the manifest now carries the absolute origin).
2. All MF chunk requests resolve against `http://localhost:3000/`.
3. "Load Remote View" mounts the `counter-view` successfully.

## Upstream Suggestion (rspack)

The divergence from webpack originates in
`rspack/crates/rspack_plugin_mf/src/manifest/mod.rs`:

```rust
PublicPath::Auto => Some("auto".to_string()),
```

Two possible improvements:

1. **Emit a runtime inferral stub** for `PublicPath::Auto` (mirroring
   webpack 5's `__webpack_require__.p` + `document.currentScript.src`
   approach), so the manifest carries a function rather than the literal
   `"auto"`.

2. **Ensure `version` propagation** in the `@module-federation/runtime`
   snapshot path when the remote is loaded via a webpack-style
   `name@url` spec (not a manifest.json URL), so
   `inferAutoPublicPath(version)` actually fires.

Either change would make `output.publicPath: "auto"` behave the same as
webpack's `publicPath: "auto"` without requiring users to hardcode dev
origins.

## Affected Files

| File                                      | Change                                                   |
| ----------------------------------------- | -------------------------------------------------------- |
| `packages/lark-demo/rsbuild.config.ts`    | Added `config.output.publicPath` override + CORS headers |
| `packages/lark-devtool/rsbuild.config.ts` | Same fix (it also exposes `cdn-manager` as a remote)     |
