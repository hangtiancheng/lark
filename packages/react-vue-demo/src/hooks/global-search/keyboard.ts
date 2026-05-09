import type { SearchResult, ValueRef } from "@/types";

interface KeyboardHandlerOptions {
  isOpen: ValueRef<boolean>;
  results: ValueRef<SearchResult[]>;
  activeIndex: ValueRef<number>;
  openSearch: () => void;
  closeSearch: () => void;
  selectActiveResult: () => void;
}

export function createGlobalSearchKeydownHandler({
  isOpen,
  results,
  activeIndex,
  openSearch,
  closeSearch,
  selectActiveResult,
}: KeyboardHandlerOptions) {
  return (event: KeyboardEvent) => {
    const isSearchShortcut =
      (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p";

    if (isSearchShortcut) {
      event.preventDefault();
      openSearch();
      return;
    }

    if (!isOpen.value) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.value.length > 0) {
        activeIndex.value = (activeIndex.value + 1) % results.value.length;
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.value.length > 0) {
        activeIndex.value =
          (activeIndex.value - 1 + results.value.length) % results.value.length;
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectActiveResult();
    }
  };
}
