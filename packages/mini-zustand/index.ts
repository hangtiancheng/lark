import { useSyncExternalStore } from "react";

type GetStateSlice<TState> = (state: TState) => TState | Partial<TState>;

type StateSlice<TState> = TState | Partial<TState> | GetStateSlice<TState>;

type StateCreator<TState> = (
  set: (partial: StateSlice<TState>) => void,
  get: () => TState,
) => TState;

type Selector<TState> = (state: TState) => TState[keyof TState];

type Listener<TState> = (
  newState: TState | Partial<TState>,
  oldState: TState,
) => void;

type Off = () => void;

interface IStore<TState> {
  getState: () => TState;
  setState: (partial: StateSlice<TState>) => void;
  subscribe: (listener: Listener<TState>) => Off;
}

function createStore<TState>(createState: StateCreator<TState>) {
  let state: TState;
  const listeners = new Set<Listener<TState>>();

  const getState = () => state;

  const setState = (partial: StateSlice<TState>) => {
    const newState =
      typeof partial === "function"
        ? (partial as GetStateSlice<TState>)(getState())
        : (partial as TState | Partial<TState>);

    if (!Object.is(state, newState)) {
      const oldState = state;
      state = { ...state, ...newState };
      listeners.forEach((listener) => listener(newState, oldState));
    }
  };

  const subscribe = (listener: Listener<TState>) => {
    listeners.add(listener);
    const off = () => {
      listeners.delete(listener);
    };
    return off;
  };

  state = createState(setState, getState);
  const store = {
    getState,
    setState,
    subscribe,
  };
  return store;
}

function useStore<TState>(
  store: IStore<TState>,
  selector?: Selector<TState>,
): TState | TState[keyof TState] {
  const state: TState = useSyncExternalStore(
    store.subscribe, // subscribe
    store.getState, // getSnapshot
  );
  return selector ? selector(state) : state;
}

export function create<TState>(createState: StateCreator<TState>) {
  const store = createStore<TState>(createState);
  return (selector?: Selector<TState>) => useStore<TState>(store, selector);
}
