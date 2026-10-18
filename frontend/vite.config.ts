import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: "0.0.0.0",
    proxy: {
      "/_genlayer/studionet": {
        target: "https://studio.genlayer.com",
        changeOrigin: true,
        rewrite: () => "/api"
      }
    }
  },
  test: { environment: "jsdom", setupFiles: "./src/testSetup.ts", globals: true }
});
