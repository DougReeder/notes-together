import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
