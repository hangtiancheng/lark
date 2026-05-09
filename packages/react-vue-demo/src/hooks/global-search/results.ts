import type { SearchResult } from "@/types";

export function areSameResults(left: SearchResult[], right: SearchResult[]) {
  if (left.length !== right.length) return false;

  return left.every((item, index) => {
    const next = right[index];
    return (
      Boolean(next) && item.id === next.id && item.updatedAt === next.updatedAt
    );
  });
}
