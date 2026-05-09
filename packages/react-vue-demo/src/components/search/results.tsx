import type { SearchActions, SearchViewState } from "@/types";
import {
  InlineSearchError,
  SearchEmptyState,
  SearchErrorState,
  SearchLoadingState,
} from "./feedback";
import { ResultItem } from "./result-item";
import { ResultsHeader } from "./results-header";

interface IProps {
  state: SearchViewState;
  actions: SearchActions;
}

export function Results({ state, actions }: IProps) {
  const showInlineError =
    state.errorMessage.length > 0 && state.status !== "error";

  return (
    <div
      id="global-search-results"
      className={`grid transition-all duration-300 ease-out ${
        state.canShowResults
          ? "translate-y-0 grid-rows-[1fr] opacity-100"
          : "-translate-y-2 grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="overflow-hidden">
        <div className="border-base-300 bg-base-100 mt-2 rounded-xl border p-2 shadow-sm">
          <ResultsHeader state={state} />
          {showInlineError ? (
            <InlineSearchError actions={actions} state={state} />
          ) : null}
          {state.status === "loading" && state.results.length === 0 ? (
            <SearchLoadingState />
          ) : null}
          {state.status === "error" ? (
            <SearchErrorState actions={actions} state={state} />
          ) : null}
          {state.status === "empty" ? <SearchEmptyState /> : null}
          {state.results.length > 0 ? (
            <ul className="menu gap-1 p-0" role="listbox">
              {state.results.map((result, index) => (
                <ResultItem
                  key={result.id}
                  result={result}
                  index={index}
                  isActive={index === state.activeIndex}
                  query={state.trimmedQuery}
                  actions={actions}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
