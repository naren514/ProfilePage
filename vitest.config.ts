import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // Modules that import the database client need a URL; unit tests never connect
    env: { DATABASE_URL: "postgresql://unit-test@localhost:1/none" },
  },
});
