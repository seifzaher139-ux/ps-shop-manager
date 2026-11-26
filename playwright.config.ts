import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 180000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
    acceptDownloads: true,
  },
  webServer: {
    command:
      'npm run typecheck && npm exec vite build -- --outDir dist-e2e && npm exec vite preview -- --outDir dist-e2e --host 127.0.0.1 --port 4173 --strictPort',
    env: { VITE_FIREBASE_EMULATORS: 'true' },
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
