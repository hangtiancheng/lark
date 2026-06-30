template hmr snippet for vite

```js
// Auto-injected by larkMvcPlugin
if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.oldTemplate = __larkTemplate;
  });
  import.meta.hot.accept((newMod) => {
    const newTemplate = newMod?.default;
    const oldTemplate = import.meta.hot.data?.oldTemplate;
    if (oldTemplate && newTemplate && oldTemplate !== newTemplate) {
      const hmr = globalThis.__lark_hmr__;
      if (hmr && hmr.hotSwapByTemplate) hmr.hotSwapByTemplate(oldTemplate, newTemplate);
    }
  });
}
```

template hmr snippet for webpack/rspack

```js
// Auto-injected by larkMvcPlugin
if (import.meta.webpackHot) {
  if (import.meta.webpackHot.data?.oldTemplate) {
    const oldTemplate = import.meta.webpackHot.data.oldTemplate;
    const newTemplate = __larkTemplate;
    if (oldTemplate !== newTemplate) {
      const hmr = globalThis.__lark_hmr__;
      if (hmr && hmr.hotSwapByTemplate) hmr.hotSwapByTemplate(oldTemplate, newTemplate);
    }
  }
  import.meta.webpackHot.dispose((data) => {
    data.oldTemplate = __larkTemplate;
  });
  import.meta.webpackHot.accept();
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
    const oldView = import.meta.hot.data?.oldView;
    if (oldView && newView && oldView !== newView) {
      const hmr = globalThis.__lark_hmr__;
      if (hmr && hmr.hotSwapByView) hmr.hotSwapByView(oldView, newView);
    }
  });
}
```

view hmr snippet for webpack/rspack

```js
// Auto-injected by larkMvcPlugin
if (import.meta.webpackHot) {
  if (import.meta.webpackHot.data?.oldView) {
    const oldView = import.meta.webpackHot.data.oldView;
    const newView = __larkViewDefault;
    if (oldView !== newView) {
      const hmr = globalThis.__lark_hmr__;
      if (hmr && hmr.hotSwapByView) hmr.hotSwapByView(oldView, newView);
    }
  }
  import.meta.webpackHot.dispose((data) => {
    data.oldView = __larkViewDefault;
  });
  import.meta.webpackHot.accept();
}
```
