import { defineConfig } from "@playwright/test";
const dataDir =
  process.env.FRAMESCRIPT_TEST_DATA_DIR ??
  "test-results/browser-data-" + Date.now() + "-" + process.pid;
export default defineConfig({
  testDir: "tests",
  outputDir: "test-results/browser-run",
  testMatch: "*.spec.ts",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5186",
    viewport: { width: 1600, height: 1000 },
  },
  webServer: {
    command: process.env.FRAMESCRIPT_TEST_PRODUCTION
      ? "npm start"
      : "npm run dev",
    env: { PORT: "5186", FRAMESCRIPT_DATA_DIR: dataDir },
    url: "http://127.0.0.1:5186",
    reuseExistingServer: false,
  },
});
