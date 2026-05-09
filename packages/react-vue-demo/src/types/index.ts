export interface ValueRef<T> {
  value: T;
}

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string;
  tags: string[];
  updatedAt: string;
}

export interface SearchResponse {
  items: SearchResult[];
  total: number;
  query: string;
}

export type SearchStatus = "idle" | "loading" | "success" | "empty" | "error";

export interface UseGlobalSearchOptions {
  cacheTtlSeconds?: number;
  debounceMs?: number;
  onSelect?: (result: SearchResult) => void;
}

export interface CacheEntry {
  items: SearchResult[];
  total: number;
  updatedAt: number;
}

export interface SearchViewState {
  isOpen: boolean;
  query: string;
  trimmedQuery: string;
  results: SearchResult[];
  total: number;
  status: SearchStatus;
  errorMessage: string;
  activeIndex: number;
  fromCache: boolean;
  isRefreshing: boolean;
  isLoading: boolean;
  canShowResults: boolean;
}

export interface SearchActions {
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (value: string) => void;
  setActiveIndex: (index: number) => void;
  selectResult: (result: SearchResult) => void;
  retry: () => void;
}
