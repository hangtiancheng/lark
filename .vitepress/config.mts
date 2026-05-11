import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type DefaultTheme } from "vitepress";
import tailwindcss from "@tailwindcss/vite";

function getShallowDirs() {
  return readdirSync(docsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        entry.name !== "public",
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function buildItems(shallowDir: string): DefaultTheme.SidebarItem[] {
  return readdirSync(join(docsDir, shallowDir))
    .filter((fileName) => fileName.endsWith(".md") && fileName !== "index.md")
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => {
      const fileNameNoExt = fileName.replace(/\.md$/, "");
      const relativePath = `${shallowDir}/${fileNameNoExt}`;
      return {
        text: fileNameNoExt,
        link: `/${relativePath}`,
      };
    });
}

function buildNavItems(shallowDir: string): DefaultTheme.NavItemWithLink[] {
  return readdirSync(join(docsDir, shallowDir))
    .filter((fileName) => fileName.endsWith(".md") && fileName !== "index.md")
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => {
      const name = fileName.replace(/\.md$/, "");
      return {
        text: name,
        link: `/${shallowDir}/${name}`,
      };
    });
}

function buildSidebar(): DefaultTheme.Sidebar {
  const shallowDirs = getShallowDirs();
  return Object.fromEntries(
    shallowDirs.map((dir) => [
      `/${dir}/`,
      [{ text: dir, items: buildItems(dir) }],
    ]),
  );
}

function buildNav(): DefaultTheme.NavItem[] {
  const shallowDirs = getShallowDirs();
  return [
    { text: "Tiancheng Hang", link: "/" },
    ...shallowDirs.map((dir) => ({
      text: dir,
      items: buildNavItems(dir),
      activeMatch: `^/${dir}/`,
    })),
  ];
}

const rootDir = dirname(fileURLToPath(import.meta.url));
const docsDir = join(rootDir, "../docs");

const base = "/";

export default defineConfig({
  srcDir: "docs",
  lang: "zh-CN",
  title: "Tiancheng Hang",
  description: "Frontend Practices",
  base,
  vite: {
    // @ts-ignore
    plugins: [tailwindcss()],
  },
  cleanUrls: true,
  ignoreDeadLinks: false,
  lastUpdated: true,
  markdown: {
    lineNumbers: true,
    config(md) {
      const defaultFence = md.renderer.rules.fence?.bind(md.renderer.rules);
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        if (token.info.trim() === "mermaid") {
          const graph = encodeURIComponent(token.content);
          return `
<Suspense>
  <template #default>
    <Mermaid id="mermaid-${idx}" graph="${graph}" />
  </template>
  <template #fallback>
    Mermaid Loading...
  </template>
</Suspense>
`;
        }

        return defaultFence
          ? defaultFence(tokens, idx, options, env, self)
          : self.renderToken(tokens, idx, options);
      };
    },
  },
  head: [
    ["link", { rel: "icon", href: `${base}logo.svg`, type: "image/svg+xml" }],
  ],
  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "Tiancheng Hang",
    nav: buildNav(),
    sidebar: buildSidebar(),
    outline: [2, 3],
    socialLinks: [
      { icon: "github", link: "https://code.byted.org/users/lark" },
    ],
    search: {
      provider: "local",
    },
  },
});
