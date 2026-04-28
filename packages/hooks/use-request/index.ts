type Service<TData, TParams extends any[]> = (
  ...args: TParams
) => Promise<TData>;

type Subscribe = () => void;
