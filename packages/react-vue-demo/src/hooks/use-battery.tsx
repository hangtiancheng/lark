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
      <div className="bg-white p-5 m-3 rounded-xl shadow-sm border border-sky-100 transition-shadow hover:shadow-md [&>p]:text-sky-600 [&>p]:font-mono [&>p]:leading-relaxed [&>p]:pb-4 [&>p]:pt-1 [&>p]:text-sm">
        <p>useBattery</p>
        <div className="p-1">
          Battery: {Math.round(level * 100)}%{charging ? "⚡️" : ""}
        </div>
      </div>
    );
  },
);
