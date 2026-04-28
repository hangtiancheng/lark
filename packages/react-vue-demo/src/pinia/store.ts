import { defineStore } from "pinia";
import { ref, computed } from "@lark/react-vue";

export const useMainStore = defineStore("main", () => {
  // state
  const count = ref(0);
  const name = ref("Jane Doe");

  // getters
  const doubled = computed(() => count.value * 2);

  // actions
  function reset() {
    count.value = 0;
  }

  return {
    count,
    name,
    doubled,
    reset,
  };
});
