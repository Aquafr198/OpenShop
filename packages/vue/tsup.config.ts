import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  treeshake: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  external: ["vue", "@openshop/core"],
});
