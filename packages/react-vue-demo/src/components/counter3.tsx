import {
  createSetup,
  ref,
  computed,
  onUnmounted,
  onMounted,
} from "@lark/react-vue";
import { useState, type Dispatch, type SetStateAction } from "react";

interface Props {
  value: number;
  setValue: Dispatch<SetStateAction<number>>;
}

const useMySetup = createSetup((props: Props) => {
  const vueCount = ref(props.value);
  const { setValue } = props;

  const doubled = computed(() => vueCount.value * 2);
  const vueInc = () => (vueCount.value += 1);
  const inc = () => setValue(vueCount.value + 1);
  const vueDec = () => (vueCount.value -= 1);
  const dec = () => setValue((value) => value - 1);

  onMounted(() => {
    console.log("[Counter3] Hello World.");
  });

  onUnmounted(() => {
    console.log("[Counter3] Goodbye World.");
  });

  return { vueCount, doubled, vueInc, inc, vueDec, dec };
});

function Counter3(props: Props) {
  const { vueCount, doubled, vueInc, inc, vueDec, dec } = useMySetup(props);

  const [value, setValue] = useState(7);

  const {
    vueCount: vueCount2,
    doubled: doubled2,
    vueInc: vueInc2,
    inc: inc2,
    vueDec: vueDec2,
    dec: dec2,
  } = useMySetup({ value, setValue });

  return (
    <div className="bg-white p-5 m-3 rounded-xl shadow-sm border border-sky-100 transition-shadow hover:shadow-md [&>p]:text-sky-600 [&>p]:font-mono [&>p]:leading-relaxed [&>p]:pb-4 [&>p]:pt-1 [&>p]:text-sm">
      <p>createSetup()</p>

      <div className="p-1">
        {vueCount} x 2 = {doubled}
      </div>

      <button onClick={vueInc}>VueInc +</button>
      <button onClick={inc}>Inc +</button>

      <button onClick={vueDec}>VueDec -</button>
      <button onClick={dec}>Dec -</button>

      <div className="p-1 mt-2">
        {vueCount2} x 2 = {doubled2}
      </div>

      <button onClick={vueInc2}>VueInc2 +</button>
      <button onClick={inc2}>Inc2 +</button>
      <button onClick={vueDec2}>VueDec2 -</button>
      <button onClick={dec2}>Dec2 -</button>
      <br />
    </div>
  );
}

export default Counter3;
