import { useSetup, ref, computed, watch } from "@lark/react-vue";
import { type Dispatch, type SetStateAction } from "react";

function Counter2(Props: {
  value: number;
  setValue: Dispatch<SetStateAction<number>>;
}) {
  const state = useSetup((props) => {
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

    return { vueCount, vueInc, inc, vueDec, dec, doubled, isSeven };
  }, Props);

  const { vueCount, vueInc, inc, vueDec, dec, doubled, isSeven } = state;
  return (
    <div className="bg-white p-5 m-3 rounded-xl shadow-sm border border-sky-100 transition-shadow hover:shadow-md [&>p]:text-sky-600 [&>p]:font-mono [&>p]:leading-relaxed [&>p]:pb-4 [&>p]:pt-1 [&>p]:text-sm">
      <p>useSetup()</p>
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
}

export default Counter2;
