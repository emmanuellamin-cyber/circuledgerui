import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against the real API. Start the CircuLedger API on :5097 first (`dotnet run`, or set
 * E2E_BASE_URL to an environment that serves both). `ng serve` is started automatically and
 * proxies /api to the API (proxy.conf.json).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env['E2E_BASE_URL']
    ? undefined
    : {
        command: 'npm start',
        url: 'http://localhost:4200',
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
