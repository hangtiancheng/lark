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
    <div className="card border-base-300 bg-base-100 h-full border shadow-sm">
      <div className="card-body gap-4">
        <h3 className="card-title text-base">createSetup()</h3>
        <div className="border-base-300 rounded-xl border p-3 text-sm">
          {vueCount} x 2 = {doubled}
        </div>
        <div className="join">
          <button
            type="button"
            className="btn btn-sm join-item"
            onClick={vueInc}
          >
            Vue +
          </button>
          <button type="button" className="btn btn-sm join-item" onClick={inc}>
            React +
          </button>
          <button
            type="button"
            className="btn btn-sm join-item"
            onClick={vueDec}
          >
            Vue -
          </button>
          <button type="button" className="btn btn-sm join-item" onClick={dec}>
            React -
          </button>
        </div>
        <div className="border-base-300 rounded-xl border p-3 text-sm">
          {vueCount2} x 2 = {doubled2}
        </div>
        <div className="join">
          <button
            type="button"
            className="btn btn-sm join-item"
            onClick={vueInc2}
          >
            Vue +
          </button>
          <button type="button" className="btn btn-sm join-item" onClick={inc2}>
            React +
          </button>
          <button
            type="button"
            className="btn btn-sm join-item"
            onClick={vueDec2}
          >
            Vue -
          </button>
          <button type="button" className="btn btn-sm join-item" onClick={dec2}>
            React -
          </button>
        </div>
      </div>
    </div>
  );
}

export default Counter3;
