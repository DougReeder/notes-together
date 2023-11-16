import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import manifest from './resources/manifest.json'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff,woff2,json}'],
      },
      manifest: manifest,
    })
  ],
  test: {
    environment: 'jsdom',
    environmentOptions: {jsdom: {url: "https://testorigin.org/", resources: "usable", pretendToBeVisual: true}},
    globals: true,
    // testTimeout: 5000,
    coverage: {enabled: false},
    // clearMocks: true,
    mockReset: true,
    // restoreMocks: true,
    // allowOnly: true,
    // slowTestThreshold: 300,
  }
})
