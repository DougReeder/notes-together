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
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.js',
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff,woff2,json}'],
        globIgnores: ['**/google*.html'],   // TODO: why doesn't this work?
        additionalManifestEntries: ['/icons/NotesTogether-icon-gray.svg', 'icons/NotesTogether-Icon-96x96.png'],
        mode: 'development',
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
