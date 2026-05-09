import { defineComponent } from "@lark/react-vue";
import { useMainStore } from "./store.js";

export const Pinia = defineComponent(
  () => {
    const main = useMainStore();
    return main;
  },
  ({ $patch, count, doubled }) => {
    return (
      <div className="card border-base-300 bg-base-100 border shadow-sm">
        <div className="card-body gap-4">
          <h3 className="card-title text-base">Pinia A</h3>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() =>
              $patch({
                count: count - 1,
              })
            }
          >
            Decrement
          </button>
          <table className="table-sm table">
            <tbody>
              <tr>
                <td>Count</td>
                <td className="text-right font-mono">{count}</td>
              </tr>
              <tr>
                <td>Doubled</td>
                <td className="text-right font-mono">{doubled}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  },
);
