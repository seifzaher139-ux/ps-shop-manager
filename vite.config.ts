import { ar } from './src/i18n/ar';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'localize-html',
      transformIndexHtml: (html) =>
        html
          .replaceAll('__APP_TITLE__', ar.app)
          .replaceAll('__APP_DESCRIPTION__', ar.appDescription),
    },
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'fonts/*'],
      manifest: {
        name: ar.manifestName,
        short_name: ar.manifestShort,
        lang: 'ar',
        dir: 'rtl',
        display: 'standalone',
        start_url: './',
        scope: './',
        background_color: '#10182d',
        theme_color: '#10182d',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 8000000,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['e2e/**', 'integration/**', 'node_modules/**'],
  },
});
