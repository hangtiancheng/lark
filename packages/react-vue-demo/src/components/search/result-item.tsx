import { Clock3, FileSearch } from "lucide-react";
import { computed, defineComponent, toRefs } from "@lark/react-vue";
import type { SearchActions, SearchViewState } from "@/types";
import type { SearchResult } from "@/types";
import { Highlight } from "./highlight";

interface IProps {
  result: SearchResult;
  index: number;
  isActive: boolean;
  query: SearchViewState["trimmedQuery"];
  actions: SearchActions;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
  });
}

const ResultIcon = defineComponent(
  () => ({}),
  () => (
    <div className="bg-base-200 text-base-content/60 flex size-9 shrink-0 items-center justify-center rounded-xl">
      <FileSearch className="size-5" />
    </div>
  ),
);

export const ResultItem = defineComponent(
  (props: IProps) => {
    const { result, index, isActive, query, actions } = toRefs(props);
    const updatedAt = computed(() => formatDate(result.value.updatedAt));

    return {
      result,
      index,
      isActive,
      query,
      actions,
      updatedAt,
    };
  },
  ({ result, index, isActive, query, actions, updatedAt }) => (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={isActive}
        onMouseEnter={() => actions.setActiveIndex(index)}
        onClick={() => actions.selectResult(result)}
        className={`flex items-start gap-3 rounded-xl p-3 text-left transition-all duration-200 ${
          isActive ? "bg-primary/10 text-primary" : "hover:bg-base-200"
        }`}
      >
        <ResultIcon />
        <span className="min-w-0 grow">
          <span className="flex flex-wrap items-center gap-2">
            <span>
              <Highlight text={result.title} query={query} />
            </span>
            <span className="badge badge-ghost badge-sm">
              {result.category}
            </span>
          </span>
          <span className="text-base-content/65 mt-1 block text-sm leading-6">
            <Highlight text={result.description} query={query} />
          </span>
          <span className="text-base-content/45 mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Clock3 className="size-3.5" />
            Updated {updatedAt}
            <span>{result.url}</span>
          </span>
        </span>
      </button>
    </li>
  ),
);
