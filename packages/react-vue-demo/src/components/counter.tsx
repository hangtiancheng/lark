import {
  defineComponent,
  ref,
  computed,
  watch,
  onUnmounted,
  onMounted,
} from "@lark/react-vue";
import type { Dispatch, SetStateAction } from "react";

const Counter = defineComponent(
  (props: { value: number; setValue: Dispatch<SetStateAction<number>> }) => {
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
      <div className="bg-white p-5 m-3 rounded-xl shadow-sm border border-sky-100 transition-shadow hover:shadow-md [&>p]:text-sky-600 [&>p]:font-mono [&>p]:leading-relaxed [&>p]:pb-4 [&>p]:pt-1 [&>p]:text-sm">
        <p>defineComponent()</p>
        <button onClick={vueInc}>VueInc +</button>
        <button onClick={inc}>Inc +</button>
        <button onClick={vueDec}>VueDec -</button>
        <button onClick={dec}>Dec -</button>
        <table>
          <tbody>
            <tr>
              <td>Count</td>
              <td>{vueCount}</td>
            </tr>
            <tr>
              <td>isSeven</td>
              <td>{isSeven ? "Yes" : "No"}</td>
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

export default Counter;
