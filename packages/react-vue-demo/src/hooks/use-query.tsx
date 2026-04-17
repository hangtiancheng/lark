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
      <div className="bg-white p-5 m-3 rounded-xl shadow-sm border border-sky-100 transition-shadow hover:shadow-md [&>p]:text-sky-600 [&>p]:font-mono [&>p]:leading-relaxed [&>p]:pb-4 [&>p]:pt-1 [&>p]:text-sm">
        <p>useFetch</p>
        <pre className="p-1 overflow-x-auto text-xs text-sky-800">
          {error
            ? `Error: ${(error as { message?: string }).message || error}`
            : isFetching
              ? "Loading..."
              : JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  },
);
