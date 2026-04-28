import { render, waitFor } from "@testing-library/react";
import { beforeEach, it, expect, vi } from "vitest";
import { useSetup, toRef, watch, watchEffect } from "../src/index.js";

const watchSpy = vi.fn();
const watchEffectSpy = vi.fn();

beforeEach(() => {
  watchSpy.mockClear();
  watchEffectSpy.mockClear();
});

const WatchTest = (Props: { hello: string }) => {
  const { other } = useSetup((props: { hello: string }) => {
    const other = toRef(props, "hello");

    watch(other, () => watchSpy());

    watchEffect(() => {
      watchEffectSpy(other.value);
    });

    return {
      other,
    };
  }, Props);

  return <p>{other}</p>;
};

it("should handle watch ref", async () => {
  const { rerender } = render(<WatchTest hello={"Hello, world"} />);

  rerender(<WatchTest hello={"Adios, world"} />);

  await waitFor(() => {
    expect(watchSpy).toHaveBeenCalled();
  });
});

it("should handle watchEffect ref", async () => {
  const comp = render(<WatchTest hello={"Hello, world"} />);

  comp.rerender(<WatchTest hello={"Adios, world"} />);

  await waitFor(() => {
    expect(watchEffectSpy).toHaveBeenCalled();
  });
});
