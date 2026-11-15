import { defineConfig } from "vitest/config";

const BACKEND_DEVELOPMENT_URL = "http://127.0.0.1:8000";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": BACKEND_DEVELOPMENT_URL },
  },
  test: {
    environment: "happy-dom",
  },
});
