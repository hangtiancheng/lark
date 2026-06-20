/**
 * Project-wide base View.
 *
 * All page-level and column-level views extend this class to inherit:
 *   - a consistent destroy log gated by the Lark debug flag
 *   - a `guard()` helper that swallows handler exceptions so a single
 *     misbehaving handler cannot tear down the whole frame digest
 *
 * Runtime semantics are identical to View.extend({...}); this file simply
 * gives every concrete view a single inheritance point for future cross-
 * cutting concerns (analytics, error reporting, feature flags, etc.).
 */
import { View } from "@lark.js/mvc";

export default View.extend({
  make() {
    this.on("destroy", () => {
      console.log(`[@lark.js/index] view destroyed: ${this.id}`);
    });
  },

  /**
   * Run a synchronous block; on error, log with a contextual label and
   * return undefined. Use this around third-party calls or DOM APIs that
   * may throw on edge browsers (e.g. localStorage in private mode).
   */
  guard<T>(label: string, fn: () => T): T | undefined {
    try {
      return fn();
    } catch (e) {
      console.error(`[@lark.js/index] ${label} failed:`, e);
      return undefined;
    }
  },
});
