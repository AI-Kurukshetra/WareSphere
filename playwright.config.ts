import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const apiBaseURL = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:4000";
const videoMode = process.env.PLAYWRIGHT_VIDEO === "on" ? "on" : "retain-on-failure";
const headless = process.env.PLAYWRIGHT_HEADLESS === "false" ? false : true;
const slowMo = Number(process.env.PLAYWRIGHT_SLOW_MO ?? 0);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    headless,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: videoMode,
    launchOptions: {
      slowMo: Number.isFinite(slowMo) ? slowMo : 0
    }
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ],
  webServer: [
    {
      command: "pnpm --filter @wms/api start",
      url: `${apiBaseURL}/health`,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000,
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: "4000",
        WMS_STORAGE: "memory",
        ALLOW_DEV_AUTH_HEADERS: "true"
      }
    },
    {
      command: "pnpm --filter @wms/web start",
      url: `${baseURL}/sign-in`,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000,
      env: {
        ...process.env,
        HOSTNAME: "127.0.0.1",
        PORT: "3000",
        API_BASE_URL: apiBaseURL,
        NEXT_PUBLIC_API_BASE_URL: apiBaseURL,
        ALLOW_DEV_AUTH_HEADERS: "true"
      }
    }
  ]
});
