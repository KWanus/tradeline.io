import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    // jsdom gives the localStorage-backed libs a window to read/write against.
    environment: "jsdom",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    clearMocks: true,
  },
});
