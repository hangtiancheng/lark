template hmr snippet for vite

```js
// Auto-injected by larkMvcPlugin
if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.oldTemplate = __larkTemplate;
  });
  import.meta.hot.accept((newMod) => {
    const newTemplate = newMod?.default;
    const oldTemplate = import.meta.hot.data.oldTemplate;
    if (oldTemplate && newTemplate && oldTemplate !== newTemplate) {
      const hmr = globalThis.__LARK_HMR__;
      if (hmr && hmr.hotSwapByTemplate)
        hmr.hotSwapByTemplate(oldTemplate, newTemplate);
    }
  });
}
```

template hmr sippet for webpack/rspack

```js
// Auto-injected by larkMvcPlugin
if (module.hot) {
  module.hot.dispose((data) => {
    data.oldTemplate = __larkTemplate;
  });
  module.hot.accept(() => {
    const newTemplate = __larkTemplate;
    const oldTemplate = module.hot.data.oldTemplate;
    if (oldTemplate && newTemplate && oldTemplate !== newTemplate) {
      const hmr = globalThis.__LARK_HMR__;
      if (hmr && hmr.hotSwapByTemplate)
        hmr.hotSwapByTemplate(oldTemplate, newTemplate);
    }
  });
}
```

view hmr snippet for vite

```js
// Auto-injected by larkMvcPlugin
if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.oldView = __larkViewDefault;
  });
  import.meta.hot.accept((newMod) => {
    const newView = newMod?.default;
    const oldView = import.meta.hot.data.oldView;
    if (oldView && newView && oldView !== newView) {
      const hmr = globalThis.__LARK_HMR__;
      if (hmr && hmr.hotSwapByView) hmr.hotSwapByView(oldView, newView);
    }
  });
}
```

view hmr snippet for webpack/rspack

```js
// Auto-injected by larkMvcPlugin
if (module.hot) {
  module.hot.accept();
  module.hot.dispose(function (data) {
    data.oldView = __larkViewDefault;
  });
  module.hot.accept(() => {
    const oldView = module.hot.data.oldView;
    const newView = __larkViewDefault;
    if (oldView && newView && oldView !== newView) {
      const hmr = globalThis.__LARK_HMR__;
      if (hmr && hmr.hotSwapByView) hmr.hotSwapByView(oldView, newView);
    }
  });
}
```
