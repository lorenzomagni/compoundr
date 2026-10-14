import { defineConfig, devices } from "@playwright/test";

// The suite seeds its own database (data/e2e.db) and runs the API on 3100 and the web app on 5173.
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://127.0.0.1:5174", trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npx tsx e2e/seed.ts && npx tsx src/server/index.ts",
      url: "http://127.0.0.1:3100/api/status",
      env: { COMPOUNDR_CONFIG: "e2e/config.json" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npx vite --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      env: { COMPOUNDR_PORT: "3100" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
