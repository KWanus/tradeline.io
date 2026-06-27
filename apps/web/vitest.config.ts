import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure cores (matches the project convention of a pure,
 * unit-tested core per module). Runs in node. We alias `server-only` to a
 * no-op stub so server-tagged libs can be imported in the test runner, and map
 * the `@/` path alias to the app root like tsconfig does.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
      "@": path.resolve(__dirname),
    },
  },
});
