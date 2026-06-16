/**
 * Lark framework constants.
 */

/** Global counter for generating unique IDs */
export let globalCounter = 0;

/** Internal splitter character (U+001E Record Separator, invisible, used as namespace separator).
 * Uses String.fromCharCode to survive bundlers that strip control-char literals. */
export const SPLITTER = String.fromCharCode(0x1e);

export const RouterEvents = {
  CHANGE: "change",
  CHANGED: "changed",
  PAGE_UNLOAD: "page_unload",
};

export const LarkInnerKeys = {
  /** Attribute name: ldk (static key for skipping DOM diff) */
  DIFF_KEY: "ldk",
  /** Attribute name: lak (static attribute key) */
  ATTR_KEY: "lak",
  /** Attribute name: lvk (view key for assign) */
  VIEW_KEY: "lvk",
};

/** Attribute name: v-lark */
export const LARK_VIEW = "v-lark";

/** View event method regex: e.g. "app\x1eclickHandler(click)" or "clickHandler()"
 * Group 1: optional frame ID (before SPLITTER)
 * Group 2: handler name
 * Group 3: params string
 */
export const EVENT_METHOD_REGEXP = new RegExp(
  `(?:([\\w-]+)${SPLITTER})?([^(]+)\\(([\\s\\S]*?)?\\)`,
);

/** View event method name regex: e.g. "name<click,mousedown>" or "$selector<click>" */
export const VIEW_EVENT_METHOD_REGEXP = /^(\$?)([\w]*)<(.*?)>(?:<([\w ,]*)>)?$/;

/** URL query/hash trim regexp */
export const URL_TRIM_HASH_REGEXP = /(?:^.*\/\/[^/]+|#.*$)/gi;

/** URL trim query regexp (before hash) */
export const URL_TRIM_QUERY_REGEXP = /^[^#]*#?!?/;

/** URL param key-value regexp */
export const URL_PARAM_REGEXP = /([^=&?/#]+)=?([^&#?]*)/g;

/** URL params test regexp */
export const IS_URL_PARAMS = /(?!^)=|&/;

/** URL query/hash trim regexp for path extraction */
export const URL_QUERY_HASH_REGEXP = /[#?].*$/;

/** SVG namespace */
export const SVG_NS = "http://www.w3.org/2000/svg";

/** MathML namespace */
export const MATH_NS = "http://www.w3.org/1998/Math/MathML";

/** Tag name regexp for I_GetNode */
export const TAG_NAME_REGEXP = /<([a-z][^/\0>\x20\t\r\n\f]+)/i;

/** HTML entity encode regexp */
export const ENCODE_REGEXP = /[&<>"'`]/g;

/** URI encode regexp */
export const URI_ENCODE_REGEXP = /[!')(*]/g;

/** Quote encode regexp */
export const QUOTE_ENCODE_REGEXP = /['"\\]/g;

/** Async task break time (ms) */
export const CALL_BREAK_TIME = 48;

/** Increment global counter and return new value */
export function nextCounter(): number {
  return ++globalCounter;
}
