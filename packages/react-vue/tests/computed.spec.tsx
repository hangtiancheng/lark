import { render, screen, waitFor } from "@testing-library/react";
import { it, expect } from "vitest";
import { useSetup, toRef, computed } from "../src/index.js";

const ComputedTest = (Props: { hello: string }) => {
  const { comp } = useSetup((props: { hello: string }) => {
    const other = toRef(props, "hello");

    const comp = computed(
      () => `${other?.value?.substring(0, 5) || ""}, Universe!`,
    );

    return {
      comp,
    };
  }, Props);

  return <p>{comp}</p>;
};

it("should handle computed properties", async () => {
  const comp = render(<ComputedTest hello={"Hello, world"} />);

  await waitFor(() => {
    const el = screen.getByText("Hello, Universe!");
    expect(el).toBeInTheDocument();
  });

  comp.rerender(<ComputedTest hello={"Adios, world"} />);

  await waitFor(() => {
    const el = screen.getByText("Adios, Universe!");
    expect(el).toBeInTheDocument();
  });
});
