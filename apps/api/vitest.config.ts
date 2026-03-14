import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@wms/db": fileURLToPath(new URL("../../packages/db/src/index.ts", import.meta.url)),
      "@wms/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "node",
    exclude: [...configDefaults.exclude, "dist/**", "**/dist/**"]
  }
});
