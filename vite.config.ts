import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/day-planner/' : '/',
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globalSetup: './vitest.globalSetup.ts',
    // Vitest blanks CSS imports by default; the category colour test reads theme.css?raw.
    css: { include: [/theme\.css/] },
  },
})
