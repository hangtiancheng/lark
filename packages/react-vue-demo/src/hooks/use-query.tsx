import { defineComponent } from "@lark/react-vue";
import { useFetch } from "@vueuse/core";

export const Query = defineComponent(
  () => {
    // using @vueuse/core's useFetch for RESTful HTTP request
    // data: ShallowRef<T | null>
    // isFetching: ShallowRef<boolean>
    // error: ShallowRef<any>
    const { data, isFetching, error } = useFetch("/json").json();

    return { data, isFetching, error };
  },
  ({ data, isFetching, error }) => {
    return (
      <div className="card border-base-300 bg-base-100 border shadow-sm">
        <div className="card-body gap-3">
          <h3 className="card-title text-base">useFetch</h3>
          <pre className="bg-base-200 max-h-72 overflow-x-auto rounded-xl p-3 text-xs">
            {error
              ? `Error: ${(error as { message?: string }).message || error}`
              : isFetching
                ? "Loading..."
                : JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    );
  },
);
