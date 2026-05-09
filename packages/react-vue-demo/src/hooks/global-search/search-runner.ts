import type { SearchResult, ValueRef, SearchStatus } from "@/types";
import { cleanupSearchCache, getCachedSearch, setCachedSearch } from "./cache";
import {
  getErrorMessage,
  isAbortError,
  parseSearchResponse,
  readErrorMessage,
} from "./response";
import { areSameResults } from "./results";

interface SearchRunnerOptions {
  cacheTtlMs: number;
  results: ValueRef<SearchResult[]>;
  status: ValueRef<SearchStatus>;
  errorMessage: ValueRef<string>;
  fromCache: ValueRef<boolean>;
  isRefreshing: ValueRef<boolean>;
  setResults: (items: SearchResult[], total: number) => void;
}

export function createSearchRunner({
  cacheTtlMs,
  results,
  status,
  errorMessage,
  fromCache,
  isRefreshing,
  setResults,
}: SearchRunnerOptions) {
  let controller: AbortController | null = null;
  let requestVersion = 0;

  function cancel() {
    requestVersion += 1;
    if (controller) controller.abort();
  }

  async function run(searchTerm: string, preferCache: boolean) {
    const key = searchTerm.toLowerCase();

    cleanupSearchCache(cacheTtlMs);
    errorMessage.value = "";

    const cached = getCachedSearch(key, cacheTtlMs);
    if (preferCache && cached) {
      setResults(cached.items, cached.total);
      status.value = cached.items.length > 0 ? "success" : "empty";
      fromCache.value = true;
      isRefreshing.value = true;
    } else {
      status.value = "loading";
      fromCache.value = false;
      isRefreshing.value = false;
    }

    cancel();
    controller = new AbortController();
    const currentVersion = requestVersion;

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchTerm)}`,
        {
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = parseSearchResponse(await response.json());
      if (currentVersion !== requestVersion) return;

      if (!areSameResults(results.value, data.items)) {
        setResults(data.items, data.total);
      }

      setCachedSearch(key, data.items, data.total, cacheTtlMs);

      status.value = data.items.length > 0 ? "success" : "empty";
      fromCache.value = false;
      errorMessage.value = "";
    } catch (error) {
      if (isAbortError(error) || currentVersion !== requestVersion) return;

      errorMessage.value = getErrorMessage(error);
      if (!cached) {
        setResults([], 0);
        status.value = "error";
      } else {
        status.value = cached.items.length > 0 ? "success" : "empty";
      }
    } finally {
      if (currentVersion === requestVersion) isRefreshing.value = false;
    }
  }

  return {
    run,
    cancel,
  };
}
