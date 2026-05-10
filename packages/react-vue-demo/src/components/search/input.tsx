import { Command, LoaderCircle, Search, X } from "lucide-react";
import { defineComponent, toRefs } from "@lark/react-vue";
import type { SearchActions, SearchViewState } from "@/types";

interface IProps {
  setInputElement: (element: HTMLInputElement | null) => void;
  state: SearchViewState;
  actions: SearchActions;
}

interface InputChangeEvent {
  currentTarget: HTMLInputElement;
}

export const Input = defineComponent(
  (props: IProps) => {
    const { setInputElement, state, actions } = toRefs(props);

    const handleChange = (event: InputChangeEvent) => {
      actions.value.setQuery(event.currentTarget.value);
    };

    return {
      setInputElement,
      state,
      actions,
      handleChange,
    };
  },
  ({ setInputElement, state, actions, handleChange }) => (
    <label className="input bg-base-100 flex h-12 w-full items-center gap-3 rounded-xl border-0 px-3 shadow-none">
      <Search className="text-base-content/50 size-5 shrink-0" />
      <input
        ref={setInputElement}
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
  ),
);
