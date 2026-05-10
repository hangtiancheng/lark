import { computed, defineComponent, toRefs } from "@lark/react-vue";
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

export const Results = defineComponent(
  (props: IProps) => {
    const { state, actions } = toRefs(props);
    const showInlineError = computed(
      () =>
        state.value.errorMessage.length > 0 && state.value.status !== "error",
    );

    return {
      state,
      actions,
      showInlineError,
    };
  },
  ({ state, actions, showInlineError }) => (
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
  ),
);
