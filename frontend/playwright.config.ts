import { defineConfig, devices } from '@playwright/test';

const E2E_STORE_FILE = process.env.E2E_STORE_FILE || '/tmp/call-calendar-e2e-store.yaml';

/**
 * Интеграционные (e2e) тесты: фронт (vite preview) + реальный FastAPI-бэк.
 * Серверы поднимаются Playwright'ом автоматически (webServer).
 * Для бэка используется чистый YAML-файл хранилища, который пересоздаётся при старте.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      cwd: '../backend',
      command: [
        '[ -x .venv/bin/python ] && PY=.venv/bin/python || PY=python',
        `rm -f "${E2E_STORE_FILE}"`,
        `DATA_FILE="${E2E_STORE_FILE}" "$PY" -m uvicorn app.main:app --port 8000`,
      ].join(' && '),
      url: 'http://localhost:8000/event-types',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run build && npm run preview -- --port 4173 --strictPort',
      cwd: '.',
      env: { VITE_API_BASE_URL: 'http://localhost:8000' },
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
