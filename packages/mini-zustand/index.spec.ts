import { create } from "zustand";
import { create as create2 } from "./";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";

interface ICntStore {
  cnt: number;
  incCnt: () => void;
  decCnt: () => void;
  resetCnt: () => void;
}

describe("mini-zustand", () => {
  it("create store", () => {
    const useCntStore = create<ICntStore>((set) => ({
      cnt: 0,
      incCnt: () => set((state) => ({ cnt: state.cnt + 1 })),
      decCnt: () => set((state) => ({ cnt: state.cnt - 1 })),
      resetCnt: () => set({ cnt: 0 }),
    }));

    const { result: cnt } = renderHook(() => useCntStore((state) => state.cnt));
    const { result } = renderHook(() => useCntStore());
    expect(cnt.current).toBe(0);

    act(() => result.current.incCnt());
    expect(cnt.current).toBe(1);

    act(() => result.current.resetCnt());
    expect(cnt.current).toBe(0);

    act(() => result.current.decCnt());
    expect(cnt.current).toBe(-1);
  });

  it("create store2", () => {
    const useCntStore2 = create2<ICntStore>((set) => ({
      cnt: 0,
      incCnt: () => set((state) => ({ cnt: state.cnt + 1 })),
      decCnt: () => set((state) => ({ cnt: state.cnt - 1 })),
      resetCnt: () => set({ cnt: 0 }),
    }));

    const { result: cnt } = renderHook(() =>
      useCntStore2((state) => state.cnt),
    );
    const { result } = renderHook(() => useCntStore2() as ICntStore);
    expect(cnt.current).toBe(0);

    act(() => result.current.incCnt());
    expect(cnt.current).toBe(1);

    act(() => result.current.resetCnt());
    expect(cnt.current).toBe(0);

    act(() => result.current.decCnt());
    expect(cnt.current).toBe(-1);
  });
});
