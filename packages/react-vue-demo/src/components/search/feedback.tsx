import { AlertTriangle, RotateCcw, Sparkles } from "lucide-react";
import { defineComponent, toRefs } from "@lark/react-vue";
import type { SearchActions, SearchViewState } from "@/types";

interface IProps {
  state: SearchViewState;
  actions: SearchActions;
}

export const InlineSearchError = defineComponent(
  (props: IProps) => {
    const { state, actions } = toRefs(props);

    return {
      state,
      actions,
    };
  },
  ({ state, actions }) => (
    <div role="alert" className="alert alert-warning alert-soft mb-3">
      <AlertTriangle className="size-5" />
      <span>{state.errorMessage}</span>
      <button
        type="button"
        className="btn btn-warning btn-sm"
        onClick={actions.retry}
      >
        <RotateCcw className="size-4" />
        Retry
      </button>
    </div>
  ),
);

export const SearchLoadingState = defineComponent(
  () => ({}),
  () => (
    <div className="space-y-3 p-2">
      <div className="skeleton h-16 w-full rounded-2xl" />
      <div className="skeleton h-16 w-full rounded-2xl" />
      <div className="skeleton h-16 w-full rounded-2xl" />
    </div>
  ),
);

export const SearchErrorState = defineComponent(
  (props: IProps) => {
    const { state, actions } = toRefs(props);

    return {
      state,
      actions,
    };
  },
  ({ state, actions }) => (
    <div role="alert" className="alert alert-error alert-soft">
      <AlertTriangle className="size-5" />
      <div className="grow">
        <h3>Search failed</h3>
        <p className="text-sm">{state.errorMessage}</p>
      </div>
      <button
        type="button"
        className="btn btn-error btn-sm"
        onClick={actions.retry}
      >
        <RotateCcw className="size-4" />
        Retry
      </button>
    </div>
  ),
);

export const SearchEmptyState = defineComponent(
  () => ({}),
  () => (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="bg-base-200 text-base-content/50 flex size-14 items-center justify-center rounded-3xl">
        <Sparkles className="size-6" />
      </div>
      <div>
        <h3 className="text-base-content">No results found</h3>
        <p className="text-base-content/60 mt-1 text-sm">
          Try a different keyword.
        </p>
      </div>
    </div>
  ),
);
