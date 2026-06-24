/**
 * Dead code, just ignore.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
};
const HTML_ESCAPE_REGEX = /[&<>'"]/g;
/**
 * Escape html chars
 */
const htmlEscape = (str: string) =>
  str.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char]);

const HTML_UNESCAPE_MAP: Record<string, string> = {
  "&amp;": "&",
  "&#38;": "&",
  "&lt;": "<",
  "&#60;": "<",
  "&gt;": ">",
  "&#62;": ">",
  "&apos;": "'",
  "&#39;": "'",
  "&quot;": '"',
  "&#34;": '"',
} as const;

const HTML_UNESCAPE_REGEX = /&(amp|#38|lt|#60|gt|#62|apos|#39|quot|#34);/g;

/**
 * Unescape html chars
 */
const htmlUnescape = (str: string) =>
  str.replace(HTML_UNESCAPE_REGEX, (char) => HTML_UNESCAPE_MAP[char]);

const rControl = /[\u0000-\u001f]/g;
const rSpecial = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g;
const rCombining = /[\u0300-\u036F]/g;

const slugify = (str: string) =>
  str
    .normalize("NFKD")
    .replace(rCombining, "")
    .replace(rControl, "")
    .replace(rSpecial, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^(\d)/, "_$1")
    .toLowerCase();

export { htmlEscape, htmlUnescape, slugify };
