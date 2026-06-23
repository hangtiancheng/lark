/**
 * Shiki syntax highlighter (lazy-loaded singleton).
 *
 * Shiki uses TextMate grammars via WASM to produce accurate,
 * VSCode-quality syntax highlighting. The output is HTML with inline
 * styles -- no external CSS needed at runtime.
 *
 * The highlighter is expensive to create (WASM + grammar loading),
 * so we lazy-load it on first use and cache the singleton.
 * Subsequent calls to getHighlighter() return instantly.
 */
import type { Highlighter, BundledLanguage } from "shiki";

const DEFAULT_LANGUAGES: BundledLanguage[] = [
  "bash",
  "cjs",
  "css",
  "csv",
  "cts",
  "docker",
  "dockerfile",
  "dotenv",
  "go",
  "graphql",
  "html",
  "http",
  "javascript",
  "js",
  "json",
  "json5",
  "jsonc",
  "jsonl",
  "jsx",
  "less",
  "make",
  "makefile",
  "markdown",
  "md",
  "mdc",
  "mdx",
  "mermaid",
  "mjs",
  "mts",
  "nginx",
  "prisma",
  "proto",
  "protobuf",
  "scss",
  "sql",
  "toml",
  "tsx",
  "typescript",
  "vue",
  "wasm",
  "xml",
  "yaml",
  "yml",
  "zsh",
];

let highlighter: Highlighter | null = null;
let initPromise: Promise<Highlighter> | null = null;

/**
 * Get or create the Shiki highlighter singleton.
 * Thread-safe: concurrent calls share the same init promise.
 */
export async function getHighlighter(
  theme?: string,
  languages?: string[],
): Promise<Highlighter> {
  if (highlighter) return highlighter;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const { createHighlighter } = await import("shiki");

    highlighter = await createHighlighter({
      themes: [theme ?? "github-dark"],
      langs: (languages as BundledLanguage[]) ?? DEFAULT_LANGUAGES,
    });

    return highlighter;
  })();

  return initPromise;
}

/**
 * Highlight a code string. Returns complete `<pre>` HTML with inline styles.
 * Falls back to escaped plain text on any error.
 */
export function highlightCode(
  hl: Highlighter,
  code: string,
  lang: string,
  theme?: string,
): string {
  try {
    const loadedLangs = hl.getLoadedLanguages();
    const safeLang = loadedLangs.includes(lang as BundledLanguage)
      ? lang
      : "text";

    return hl.codeToHtml(code, {
      lang: safeLang,
      theme: theme ?? "github-dark",
    });
  } catch {
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
