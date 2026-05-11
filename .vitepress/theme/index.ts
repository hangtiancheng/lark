/// <reference types="vitepress/client" />

import DefaultTheme from "vitepress/theme-without-fonts";
import type { Theme } from "vitepress";
import Mermaid from "./Mermaid.vue";
import "./style.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("Mermaid", Mermaid);
  },
} satisfies Theme;
