import {
  defineComponent,
  ref,
  computed,
  watch,
  onUnmounted,
  onMounted,
} from "@lark/react-vue";
import type { Dispatch } from "@/types";

interface IProps {
  value: number;
  setValue: Dispatch<number>;
}

const Counter = defineComponent(
  (props: IProps) => {
    const vueCount = ref(props.value);
    const { setValue } = props;

    const vueInc = () => (vueCount.value += 1);
    const inc = () => setValue(vueCount.value + 1);

    const vueDec = () => (vueCount.value -= 1);
    const dec = () => setValue((value) => value - 1);

    const doubled = computed(() => vueCount.value * 2);
    const isSeven = ref(false);

    watch(
      () => props.value,
      (v) => (vueCount.value = v),
    );
    watch(vueCount, (v) => (isSeven.value = v === 7), { immediate: true });

    onMounted(() => {
      console.log("[Counter] Hello World.");
    });

    onUnmounted(() => {
      console.log("[Counter] Goodbye World.");
    });

    return { vueCount, vueInc, inc, vueDec, dec, doubled, isSeven };
  },
  ({ vueCount, vueInc, inc, vueDec, dec, doubled, isSeven }) => {
    return (
      <div className="card border-base-300 bg-base-100 h-full border shadow-sm">
        <div className="card-body gap-4">
          <h3 className="card-title text-base">defineComponent()</h3>
          <div className="join">
            <button
              type="button"
              className="btn btn-sm join-item"
              onClick={vueInc}
            >
              Vue +
            </button>
            <button
              type="button"
              className="btn btn-sm join-item"
              onClick={inc}
            >
              Parent +
            </button>
            <button
              type="button"
              className="btn btn-sm join-item"
              onClick={vueDec}
            >
              Vue -
            </button>
            <button
              type="button"
              className="btn btn-sm join-item"
              onClick={dec}
            >
              Parent -
            </button>
          </div>

          <div className="border-base-300 overflow-x-auto rounded-xl border">
            <table className="table-sm table">
              <tbody>
                <tr>
                  <td className="font-medium">Count</td>
                  <td className="text-right">
                    {vueCount}
                  </td>
                </tr>
                <tr>
                  <td className="font-medium">isSeven</td>
                  <td className="text-right">{isSeven ? "Yes" : "No"}</td>
                </tr>
                <tr>
                  <td className="font-medium">Doubled</td>
                  <td className="text-right">{doubled}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  },
);

export default Counter;
