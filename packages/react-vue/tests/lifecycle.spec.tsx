import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, it, expect, vi } from "vitest";
import {
  useSetup,
  ref,
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
} from "../src/index.js";

const onMountedSpy = vi.fn();
const onBeforeMountSpy = vi.fn();
const onUnmountedSpy = vi.fn();
const onUpdatedSpy = vi.fn();
const onBeforeUnmountSpy = vi.fn();
const onBeforeUpdateSpy = vi.fn();

beforeEach(() => {
  onMountedSpy.mockClear();
  onBeforeMountSpy.mockClear();
  onUnmountedSpy.mockClear();
  onUpdatedSpy.mockClear();
  onBeforeUnmountSpy.mockClear();
  onBeforeUpdateSpy.mockClear();
});

const LifecycleTest = () => {
  const { num, addOne } = useSetup(() => {
    const val = ref(0);

    const addToVal = () => (val.value += 1);

    onBeforeMount(() => onBeforeMountSpy());
    onMounted(() => onMountedSpy());
    onBeforeUpdate(() => onBeforeUpdateSpy());
    onUpdated(() => onUpdatedSpy());
    onBeforeUnmount(() => onBeforeUnmountSpy());
    onUnmounted(() => onUnmountedSpy());

    return {
      num: val,
      addOne: addToVal,
    };
  }, {});

  return (
    <div>
      <p>{num}</p>
      <button onClick={addOne}>Add one</button>
    </div>
  );
};

it("should handle mount lifecycles", async () => {
  render(<LifecycleTest />);

  await waitFor(() => {
    expect(onBeforeMountSpy).toHaveBeenCalled();
    expect(onMountedSpy).toHaveBeenCalled();
  });
});

it("should handle update lifecycles", async () => {
  render(<LifecycleTest />);

  fireEvent.click(screen.getByText("Add one"));

  await waitFor(() => {
    expect(onBeforeUpdateSpy).toHaveBeenCalled();
    expect(onUpdatedSpy).toHaveBeenCalled();
  });
});

it("should handle unmount lifecycles", async () => {
  const comp = render(<LifecycleTest />);

  comp.unmount();

  await waitFor(() => {
    expect(onBeforeUnmountSpy).toHaveBeenCalled();
    expect(onUnmountedSpy).toHaveBeenCalled();
  });
});
