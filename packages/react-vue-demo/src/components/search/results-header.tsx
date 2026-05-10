import { ArrowDown, ArrowUp, CornerDownLeft, LoaderCircle } from "lucide-react";
import { defineComponent, toRefs } from "@lark/react-vue";
import type { SearchViewState } from "@/types";

interface IProps {
  state: SearchViewState;
}

export const ResultsHeader = defineComponent(
  (props: IProps) => {
    const { state } = toRefs(props);

    return {
      state,
    };
  },
  ({ state }) => (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2">
      <div className="text-base-content/60 flex flex-wrap items-center gap-2 text-sm">
        <span>{state.total} results</span>
        {state.fromCache ? (
          <span className="badge badge-ghost badge-sm">Cached</span>
        ) : null}
        {state.isRefreshing ? (
          <span className="badge badge-ghost badge-sm gap-1">
            <LoaderCircle className="size-3 animate-spin" />
            Refreshing
          </span>
        ) : null}
      </div>
      <div className="text-base-content/50 hidden items-center gap-1 text-xs md:flex">
        <kbd className="kbd kbd-xs">
          <ArrowUp className="size-3" />
        </kbd>
        <kbd className="kbd kbd-xs">
          <ArrowDown className="size-3" />
        </kbd>
        <span>Select</span>
        <kbd className="kbd kbd-xs">
          <CornerDownLeft className="size-3" />
        </kbd>
        <span>Open</span>
        <kbd className="kbd kbd-xs">Esc</kbd>
        <span>Close</span>
      </div>
    </div>
  ),
);
