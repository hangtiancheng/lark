import { createModuleFederationConfig } from "@module-federation/vite";

const moduleFederationConfig = createModuleFederationConfig({
  name: "lark_demo",
  filename: "remoteEntry.js",
  exposes: {
    "./counter-view": "./src/exposed/counter-view.ts",
  },
  shared: {
    "@lark.js/mvc": { singleton: true, requiredVersion: "*" },
  },
});

export default moduleFederationConfig;
