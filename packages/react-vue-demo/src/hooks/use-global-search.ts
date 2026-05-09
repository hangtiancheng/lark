import {
  computed,
  createSetup,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "@lark/react-vue";
import { createGlobalSearchKeydownHandler } from "./global-search/keyboard";
import { createSearchRunner } from "./global-search/search-runner";
import type {
  SearchResult,
  SearchStatus,
  UseGlobalSearchOptions,
} from "@/types";

const defaultCacheTtlSeconds = 30;
const defaultDebounceMs = 320;

export const useGlobalSearch = createSetup(
  (options: UseGlobalSearchOptions) => {
    const cacheTtlMs =
      (options.cacheTtlSeconds ?? defaultCacheTtlSeconds) * 1000;
    const debounceMs = options.debounceMs ?? defaultDebounceMs;

    const isOpen = ref(false);
    const query = ref("");
    const results = ref<SearchResult[]>([]);
    const total = ref(0);
    const status = ref<SearchStatus>("idle");
    const errorMessage = ref("");
    const activeIndex = ref(0);
    const fromCache = ref(false);
    const isRefreshing = ref(false);

    const trimmedQuery = computed(() => query.value.trim());
    const selectedResult = computed(
      () => results.value[activeIndex.value] ?? null,
    );
    const isLoading = computed(() => status.value === "loading");
    const canShowResults = computed(
      () =>
        isOpen.value &&
        trimmedQuery.value.length > 0 &&
        status.value !== "idle",
    );

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    function setResults(items: SearchResult[], nextTotal: number) {
      results.value = items;
      total.value = nextTotal;
      activeIndex.value =
        items.length > 0 ? Math.min(activeIndex.value, items.length - 1) : 0;
    }

    function resetSearch() {
      if (debounceTimer) clearTimeout(debounceTimer);
      searchRunner.cancel();

      setResults([], 0);
      status.value = "idle";
      errorMessage.value = "";
      fromCache.value = false;
      isRefreshing.value = false;
    }

    function openSearch() {
      isOpen.value = true;
    }

    function closeSearch() {
      isOpen.value = false;
      activeIndex.value = 0;
    }

    function setQuery(value: string) {
      query.value = value;
    }

    function setActiveIndex(index: number) {
      if (results.value.length === 0) {
        activeIndex.value = 0;
        return;
      }

      activeIndex.value = Math.max(
        0,
        Math.min(index, results.value.length - 1),
      );
    }

    function selectResult(result: SearchResult) {
      options.onSelect?.(result);
      closeSearch();
    }

    function selectActiveResult() {
      if (selectedResult.value) selectResult(selectedResult.value);
    }

    const searchRunner = createSearchRunner({
      cacheTtlMs,
      results,
      status,
      errorMessage,
      fromCache,
      isRefreshing,
      setResults,
    });

    function retry() {
      const searchTerm = trimmedQuery.value;
      if (searchTerm.length === 0) return;
      void searchRunner.run(searchTerm, false);
    }

    watch(trimmedQuery, (searchTerm) => {
      activeIndex.value = 0;

      if (debounceTimer) clearTimeout(debounceTimer);

      if (searchTerm.length === 0) {
        resetSearch();
        return;
      }

      debounceTimer = setTimeout(() => {
        void searchRunner.run(searchTerm, true);
      }, debounceMs);
    });

    const handleKeyDown = createGlobalSearchKeydownHandler({
      isOpen,
      results,
      activeIndex,
      openSearch,
      closeSearch,
      selectActiveResult,
    });

    onMounted(() => {
      window.addEventListener("keydown", handleKeyDown);
    });

    onUnmounted(() => {
      window.removeEventListener("keydown", handleKeyDown);
      if (debounceTimer) clearTimeout(debounceTimer);
      searchRunner.cancel();
    });

    return {
      state: {
        isOpen,
        query,
        trimmedQuery,
        results,
        total,
        status,
        errorMessage,
        activeIndex,
        fromCache,
        isRefreshing,
        isLoading,
        canShowResults,
      },
      actions: {
        openSearch,
        closeSearch,
        setQuery,
        setActiveIndex,
        selectResult,
        retry,
      },
    };
  },
);
