import { defineComponent } from "@lark/react-vue";
import { useMainStore } from "./store.js";

export const Pinia = defineComponent(
  () => {
    const main = useMainStore();
    return main;
  },
  ({ $patch, count, doubled }) => {
    return (
      <div className="bg-white p-5 m-3 rounded-xl shadow-sm border border-sky-100 transition-shadow hover:shadow-md [&>p]:text-sky-600 [&>p]:font-mono [&>p]:leading-relaxed [&>p]:pb-4 [&>p]:pt-1 [&>p]:text-sm">
        <p>Pinia A</p>
        <button
          onClick={() =>
            $patch({
              count: count - 1,
            })
          }
        >
          Dec -
        </button>
        <code> </code>
        <table>
          <tbody>
            <tr>
              <td>Count</td>
              <td>{count}</td>
            </tr>
            <tr>
              <td>Doubled</td>
              <td>{doubled}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  },
);
