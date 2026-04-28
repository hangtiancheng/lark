import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const filename__ = fileURLToPath(import.meta.url);
const dirname__ = dirname(filename__);

export default defineConfig({
  define: {
    __DEV__: true,
    __BROWSER__: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: resolve(dirname__, "./setup-tests.ts"),
    include: [
      "**/*.test.ts?(x)",
      "**/*.spec.ts?(x)",
    ],
  },
});
