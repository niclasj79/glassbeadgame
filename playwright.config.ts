import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    // Point at an already-running dev server with GBG_BASE_URL. Useful locally:
    // starting a second Vite server while one is already up doubles the content
    // gate and the module graph, and on a loaded machine that is enough to push
    // first paint past the per-test timeout.
    baseURL: process.env.GBG_BASE_URL ?? "http://127.0.0.1:4173",
    browserName: "chromium",
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    trace: "retain-on-failure",
  },
  ...(process.env.GBG_BASE_URL
    ? {}
    : {
        webServer: {
          command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
          url: "http://127.0.0.1:4173",
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      }),
});
