import { defineComponent } from "@lark/react-vue";
import { setupGlobalSearchDom } from "@/hooks/global-search/dom";
import { setupGlobalSearch } from "@/hooks/use-global-search";
import type { SearchResult } from "@/types";
import { Input } from "./input";
import { Results } from "./results";

interface IProps {
  cacheTtlSeconds?: number;
}

export const GlobalSearch = defineComponent(
  (props: IProps) => {
    const { state, actions } = setupGlobalSearch({
      cacheTtlSeconds: props.cacheTtlSeconds ?? 30,
      onSelect: handleSelect,
    });
    const dom = setupGlobalSearchDom({ isOpen: state.isOpen });

    return {
      state,
      actions,
      dom,
    };
  },
  ({ state, actions, dom }) => (
    <div ref={dom.setRootElement} className="w-full">
      <div
        className={`mx-auto transition-all duration-300 ease-out ${
          state.isOpen ? "max-w-2xl" : "max-w-xl"
        }`}
      >
        <div
          className={`bg-base-100 rounded-2xl border p-2 shadow-sm transition-all duration-300 ${
            state.isOpen
              ? "border-primary/40 ring-primary/10 ring-2"
              : "border-base-300 hover:border-primary/30"
          }`}
        >
          <Input
            setInputElement={dom.setInputElement}
            state={state}
            actions={actions}
          />
          <Results state={state} actions={actions} />
        </div>
      </div>
    </div>
  ),
);

function handleSelect(result: SearchResult) {
  window.history.pushState(null, "", result.url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
