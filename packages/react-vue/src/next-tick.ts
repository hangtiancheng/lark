export function nextTick(fn?: (...args: unknown[]) => void) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      if (fn) fn();
      resolve();
    }, 0);
  });
}
