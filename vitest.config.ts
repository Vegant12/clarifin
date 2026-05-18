import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [
      ["tests/components/**", "jsdom"],
      ["src/components/**/*.test.tsx", "jsdom"],
    ],
    setupFiles: ["./vitest.setup.ts", "./tests/setup-dom.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
    passWithNoTests: true,
    coverage: { provider: "v8", reporter: ["text", "lcov"] },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./vitest.server-only-stub.ts"),
    },
  },
  css: {
    postcss: { plugins: [] },
  },
});
