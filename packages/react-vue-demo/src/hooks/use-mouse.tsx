import { defineComponent } from "@lark/react-vue";
import { useMouse } from "@vueuse/core";

export const Mouse = defineComponent(
  () => {
    // x: ShallowRef<number>
    // y: ShallowRef<number>
    const { x, y } = useMouse();
    return { x, y };
  },
  ({ x, y }) => {
    return (
      <div className="bg-white p-5 m-3 rounded-xl shadow-sm border border-sky-100 transition-shadow hover:shadow-md [&>p]:text-sky-600 [&>p]:font-mono [&>p]:leading-relaxed [&>p]:pb-4 [&>p]:pt-1 [&>p]:text-sm">
        <p>useMouse</p>
        <div className="p-1">
          {x} x {y}
        </div>
      </div>
    );
  },
);
