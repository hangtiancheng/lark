import { defineComponent } from "@lark/react-vue";
import { useBattery } from "@vueuse/core";

export const Battery = defineComponent(
  () => {
    // level: ShallowRef<number>
    // charging: ShallowRef<boolean>
    const { level, charging } = useBattery();
    return { level, charging };
  },
  ({ level, charging }) => {
    return (
      <div className="card border-base-300 bg-base-100 border shadow-sm">
        <div className="card-body gap-3">
          <h3 className="card-title text-base">useBattery</h3>
          <div className="font-mono text-sm">
            {Math.round(level * 100)}% {charging ? "charging" : "idle"}
          </div>
        </div>
      </div>
    );
  },
);
