/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import macros from 'unplugin-parcel-macros'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// GitHub Pages serves a project site under /<repo>/. Allow override via BASE_PATH.
const base = process.env.BASE_PATH ?? '/portfolio-tracker/'
const rootDir = dirname(fileURLToPath(import.meta.url))

const stripCssInVitest = {
  name: 'strip-css-in-vitest',
  enforce: 'pre' as const,
  load(id: string) {
    if (process.env.VITEST && id.endsWith('.css')) {
      return 'export default {}'
    }
    return undefined
  },
}

// https://vite.dev/config/
export default defineConfig(({mode}) => ({
  base,
  resolve: mode === 'test'
    ? {
        alias: [
          {find: '@adobe/react-spectrum', replacement: resolve(rootDir, 'test-support/react-spectrum-shim.tsx')},
          {find: /^@react-spectrum\/s2\/illustrations(?:\/.*)?$/, replacement: resolve(rootDir, 'test-support/illustrations-shim.tsx')},
          {find: /^@react-spectrum\/s2(?!\/illustrations)(?:\/.*)?$/, replacement: resolve(rootDir, 'test-support/react-spectrum-s2-shim.tsx')},
          {find: /^@spectrum-icons\/illustrations(?:\/.*)?$/, replacement: resolve(rootDir, 'test-support/illustrations-shim.tsx')},
        ],
      }
    : undefined,
  plugins: [
    macros.vite(),
    stripCssInVitest,
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Portfolio & Tax Tracker',
        short_name: 'Tracker',
        description:
          'Browser-only personal investment & Indian tax (ITR) tracker. All data stays on your device.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
  build: {
    target: ['es2022'],
    cssMinify: 'lightningcss',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/macro-(.*)\.css$/.test(id) || /@react-spectrum\/s2\/.*\.css$/.test(id)) {
            return 's2-styles'
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    server: {
      deps: {
        inline: ['@adobe/react-spectrum', '@react-spectrum/s2', '@spectrum-icons/workflow', '@spectrum-icons/illustrations'],
      },
    },
  },
}))
