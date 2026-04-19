import path from "path";
import MagicString, { type SourceMap } from "magic-string";
import picomatch from "picomatch";

export interface ConditionalBundleOptions {
  includes?: string[];
  excludes?: string[];
  vars?: Record<string, unknown>;
}

const DEFAULT_INCLUDES = ["**/*"];

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
  const isMatch = picomatch(includes || DEFAULT_INCLUDES);
  const isExclude = excludes ? picomatch(excludes) : () => false;
  const cwd = normalizeFileId(process.cwd());

  return function (id: string): boolean {
    if (!id || typeof id !== "string") return false;

    const normalizedId = normalizeFileId(id);
    if (
      !normalizedId ||
      normalizedId.startsWith("\0") ||
      normalizedId.includes("/node_modules/")
    ) {
      return false;
    }

    const candidates = getMatchCandidates(normalizedId, cwd);
    const included = candidates.some((candidate) => isMatch(candidate));
    const excluded = candidates.some((candidate) => isExclude(candidate));

    return included && !excluded;
  };
}

export function normalizeFileId(id: string): string {
  return id.split("?")[0].split("#")[0].replaceAll("\\", "/");
}

export function hasConditionalDirective(code: string): boolean {
  return (
    code.includes("#if") ||
    code.includes("#elif") ||
    code.includes("#else") ||
    code.includes("#endif")
  );
}

function getMatchCandidates(id: string, cwd: string): string[] {
  const candidates = new Set<string>();
  const normalizedId = normalizeFileId(id);

  candidates.add(normalizedId);
  candidates.add(path.posix.basename(normalizedId));

  if (normalizedId.startsWith(`${cwd}/`)) {
    candidates.add(normalizedId.slice(cwd.length + 1));
  }

  return [...candidates];
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

export function transformConditionalSource(
  code: string,
  vars: Record<string, unknown> = {},
): { code: string; map: SourceMap } | null {
  if (!hasConditionalDirective(code)) {
    return null;
  }

  return transformConditional(code, vars);
}
