import MagicString, { type SourceMap } from "magic-string";
import picomatch from "picomatch";

export interface ConditionalBundleOptions {
  includes?: string[];
  excludes?: string[];
  vars?: Record<string, unknown>;
}

export function evaluateCondition(
  condition: string,
  vars: Record<string, unknown>,
): boolean {
  try {
    const keys = Object.keys(vars);
    const values = Object.values(vars);
    const fn = new Function(...keys, `return ${condition};`);
    return !!fn(...values);
  } catch (e) {
    if (e instanceof ReferenceError) {
      return false;
    }
    console.warn(
      `[ConditionalPlugin] Failed to evaluate condition: ${condition}`,
      e,
    );
    return false;
  }
}

export function createFilter(includes?: string[], excludes?: string[]) {
  const isMatch = picomatch(includes || ["**/*"]);
  const isExclude = excludes ? picomatch(excludes) : () => false;

  return function (id: string): boolean {
    if (!id || typeof id !== "string") return false;
    if (id.includes("node_modules")) return false;
    return isMatch(id) && !isExclude(id);
  };
}

const ifRegex = /^[ \t]*\/\/[ \t]*#if[ \t]+(.+)$/;
const elifRegex = /^[ \t]*\/\/[ \t]*#elif[ \t]+(.+)$/;
const elseRegex = /^[ \t]*\/\/[ \t]*#else[ \t]*$/;
const endifRegex = /^[ \t]*\/\/[ \t]*#endif[ \t]*$/;

interface StackState {
  matched: boolean;
  hasHandled: boolean;
  parentActive: boolean;
}

export function transformConditional(
  code: string,
  vars: Record<string, unknown> = {},
): { code: string; map: SourceMap } | null {
  const lines = code.split("\n");
  const ms = new MagicString(code);
  const stack: StackState[] = [];

  let currentOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Calculate line length including newline character
    // The last line might not have a newline character
    const lineLength = line.length + (i < lines.length - 1 ? 1 : 0);

    let match: RegExpMatchArray | null;
    let isDirective = false;

    if ((match = line.match(ifRegex))) {
      const condition = match[1];
      // Only evaluate if all parent blocks are active
      const parentActive = stack.every((state) => state.matched);
      let isTrue = false;
      if (parentActive) {
        isTrue = evaluateCondition(condition, vars);
      }
      stack.push({ matched: isTrue, hasHandled: isTrue, parentActive });
      isDirective = true;
    } else if ((match = line.match(elifRegex))) {
      const condition = match[1];
      if (stack.length === 0) {
        console.warn("[ConditionalPlugin] #elif without #if");
        currentOffset += lineLength;
        continue;
      }
      const top = stack[stack.length - 1];
      if (top.hasHandled || !top.parentActive) {
        top.matched = false;
      } else {
        const isTrue = evaluateCondition(condition, vars);
        top.matched = isTrue;
        if (isTrue) top.hasHandled = true;
      }
      isDirective = true;
    } else if ((match = line.match(elseRegex))) {
      if (stack.length === 0) {
        console.warn("[ConditionalPlugin] #else without #if");
        currentOffset += lineLength;
        continue;
      }
      const top = stack[stack.length - 1];
      top.matched = top.parentActive && !top.hasHandled;
      top.hasHandled = true;
      isDirective = true;
    } else if ((match = line.match(endifRegex))) {
      if (stack.length === 0) {
        console.warn("[ConditionalPlugin] #endif without #if");
        currentOffset += lineLength;
        continue;
      }
      stack.pop();
      isDirective = true;
    }

    // Check if the current line should be included based on the stack state
    const shouldInclude = stack.every((state) => state.matched);

    if (isDirective || !shouldInclude) {
      // Remove the line content
      // Use currentOffset for start and currentOffset + lineLength for end
      ms.remove(currentOffset, currentOffset + lineLength);
    }

    currentOffset += lineLength;
  }

  if (ms.hasChanged()) {
    return {
      code: ms.toString(),
      map: ms.generateMap({ hires: true }),
    };
  }
  return null;
}
