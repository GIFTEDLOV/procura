import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3001);

export default defineConfig({ testDir: "../tests/e2e", use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" }, webServer: { command: `pnpm dev -- --port ${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: true }, projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }] });
