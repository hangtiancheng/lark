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
      <div className="card border-base-300 bg-base-100 border shadow-sm">
        <div className="card-body gap-3">
          <h3 className="card-title text-base">useMouse</h3>
          <div className="font-mono text-sm">
            {x} x {y}
          </div>
        </div>
      </div>
    );
  },
);
