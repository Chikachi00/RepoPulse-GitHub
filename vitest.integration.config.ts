import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@repopulse/database": fileURLToPath(
        new URL("./packages/database/src/index.ts", import.meta.url)
      ),
      "@repopulse/shared": fileURLToPath(
        new URL("./packages/shared/src/index.ts", import.meta.url)
      ),
      "@repopulse/analysis-engine": fileURLToPath(
        new URL("./packages/analysis-engine/src/index.ts", import.meta.url)
      )
    }
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 90_000,
    testTimeout: 45_000
  }
});
