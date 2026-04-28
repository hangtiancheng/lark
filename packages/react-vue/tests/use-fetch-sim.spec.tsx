import { render, waitFor, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { defineComponent } from "../src/index.js";
import { shallowRef } from "@vue/reactivity";

const Query = defineComponent(
  () => {
    const isFetching = shallowRef(false);

    // Simulate useFetch immediate behavior
    Promise.resolve().then(() => {
      isFetching.value = true;
      setTimeout(() => {
        isFetching.value = false;
      }, 50);
    });

    return { isFetching };
  },
  ({ isFetching }) => {
    return <div data-testid="status">{isFetching ? "Loading" : "Done"}</div>;
  },
);

it("should render Loading then Done", async () => {
  render(<Query />);

  // It initially renders Done because it's synchronously false
  expect(screen.getByTestId("status").textContent).toBe("Done");

  // Then it should switch to Loading
  await waitFor(() => {
    expect(screen.getByTestId("status").textContent).toBe("Loading");
  });

  // Then it should switch back to Done
  await waitFor(() => {
    expect(screen.getByTestId("status").textContent).toBe("Done");
  });
});
