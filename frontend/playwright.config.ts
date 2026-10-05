import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3001);

export default defineConfig({ testDir: "../tests/e2e", use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" }, webServer: { command: `pnpm exec vite --host 0.0.0.0 --port ${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: true }, projects: [
  { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  { name: "tablet-1024", use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 900 } } },
  { name: "mobile-430", use: { ...devices["Desktop Chrome"], viewport: { width: 430, height: 932 } } },
  { name: "mobile-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
] });
