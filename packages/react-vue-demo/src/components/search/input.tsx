import { Command, LoaderCircle, Search, X } from "lucide-react";
import type { ChangeEvent, RefObject } from "react";
import type { SearchActions, SearchViewState } from "@/types";

interface IProps {
  inputRef: RefObject<HTMLInputElement | null>;
  state: SearchViewState;
  actions: SearchActions;
}

export function Input({ inputRef, state, actions }: IProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    actions.setQuery(event.currentTarget.value);
  };

  return (
    <label className="input bg-base-100 flex h-12 w-full items-center gap-3 rounded-xl border-0 px-3 shadow-none">
      <Search className="text-base-content/50 size-5 shrink-0" />
      <input
        ref={inputRef}
        value={state.query}
        onChange={handleChange}
        onFocus={actions.openSearch}
        type="search"
        className="grow text-base"
        placeholder="Search..."
        aria-expanded={state.isOpen}
        aria-controls="global-search-results"
        aria-autocomplete="list"
      />
      {state.isRefreshing || state.isLoading ? (
        <LoaderCircle className="text-primary size-5 shrink-0 animate-spin" />
      ) : null}
      {state.query.length > 0 ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-circle"
          onClick={() => actions.setQuery("")}
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      ) : null}
      <div className="hidden items-center gap-1 md:flex">
        <kbd className="kbd kbd-sm">
          <Command className="size-3" />
        </kbd>
        <kbd className="kbd kbd-sm">P</kbd>
      </div>
    </label>
  );
}
