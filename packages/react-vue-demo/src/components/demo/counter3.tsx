import {
  createSetup,
  ref,
  computed,
  onUnmounted,
  onMounted,
  watch,
} from "@lark/react-vue";
import type { Dispatch } from "@/types";

interface Props {
  value: number;
  setValue: Dispatch<number>;
}

const useMySetup = createSetup((props: Props) => {
  const vueCount = ref(props.value);
  const { setValue } = props;

  const doubled = computed(() => vueCount.value * 2);
  const vueInc = () => (vueCount.value += 1);
  const inc = () => setValue(vueCount.value + 1);
  const vueDec = () => (vueCount.value -= 1);
  const dec = () => setValue((value) => value - 1);

  watch(
    () => props.value,
    (value) => {
      vueCount.value = value;
    },
  );

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

  return (
    <div className="card border-base-300 bg-base-100 h-full border shadow-sm">
      <div className="card-body gap-4">
        <h3 className="card-title text-base">createSetup()</h3>
        <div className="border-base-300 rounded-xl border p-3 text-sm">
          {vueCount} x 2 = {doubled}
        </div>
        <button type="button" className="btn btn-sm join-item" onClick={vueInc}>
          Vue +
        </button>
        <button type="button" className="btn btn-sm join-item" onClick={inc}>
          Parent +
        </button>
        <button type="button" className="btn btn-sm join-item" onClick={vueDec}>
          Vue -
        </button>
        <button type="button" className="btn btn-sm join-item" onClick={dec}>
          Parent -
        </button>
      </div>
    </div>
  );
}

export default Counter3;
