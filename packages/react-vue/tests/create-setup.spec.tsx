import { render, screen, waitFor } from "@testing-library/react";
import { it, expect } from "vitest";
import { createSetup, ref } from "../src/index.js";

const useMsg = createSetup(() => {
  const msg = ref("Hello, world!");

  return {
    msg,
  };
});

const CreateSetupTest = () => {
  const { msg } = useMsg({});
  return <p>{msg}</p>;
};

it("should render basic createSetup return", async () => {
  render(<CreateSetupTest />);

  await waitFor(() => {
    const el = screen.getByText("Hello, world!");
    expect(el).toBeInTheDocument();
  });
});
