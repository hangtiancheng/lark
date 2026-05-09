import type { SearchResponse, SearchResult } from "@/types";

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isSearchResult(value: unknown): value is SearchResult {
  if (!isObject(value)) return false;

  const id: unknown = Reflect.get(value, "id");
  const title: unknown = Reflect.get(value, "title");
  const description: unknown = Reflect.get(value, "description");
  const category: unknown = Reflect.get(value, "category");
  const url: unknown = Reflect.get(value, "url");
  const tags: unknown = Reflect.get(value, "tags");
  const updatedAt: unknown = Reflect.get(value, "updatedAt");

  return (
    typeof id === "string" &&
    typeof title === "string" &&
    typeof description === "string" &&
    typeof category === "string" &&
    typeof url === "string" &&
    isStringArray(tags) &&
    typeof updatedAt === "string"
  );
}

export function parseSearchResponse(value: unknown): SearchResponse {
  if (!isObject(value)) {
    return {
      items: [],
      total: 0,
      query: "",
    };
  }

  const items: unknown = Reflect.get(value, "items");
  const total: unknown = Reflect.get(value, "total");
  const query: unknown = Reflect.get(value, "query");
  const parsedItems = Array.isArray(items) ? items.filter(isSearchResult) : [];

  return {
    items: parsedItems,
    total: typeof total === "number" ? total : parsedItems.length,
    query: typeof query === "string" ? query : "",
  };
}

export async function readErrorMessage(response: Response) {
  const fallback = `Request failed with status ${response.status}`;

  try {
    const value: unknown = await response.json();
    if (!isObject(value)) return fallback;

    const message: unknown = Reflect.get(value, "message");
    return typeof message === "string" ? message : fallback;
  } catch {
    return fallback;
  }
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "A network error occurred. Please try again later.";
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
