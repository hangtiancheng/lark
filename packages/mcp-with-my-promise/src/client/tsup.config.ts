import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    bundle: "src/index.tsx",
  },
  format: ["esm"],
  outDir: "dist",
  sourcemap: true,
  clean: true,
  splitting: false,
  outExtension: () => ({ js: ".js" }),
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "development",
    ),
  },
});
