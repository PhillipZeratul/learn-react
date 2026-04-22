/// <reference types="vitest/config" />
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const isTauri = process.env.TAURI_ENV === 'true' || process.env.VITE_PLATFORM === 'tauri';
const isCapacitor = process.env.CAPACITOR_ENV === 'true' || process.env.VITE_PLATFORM === 'capacitor';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  server: {
    headers: {
      // Required for WebSQLite OPFS high-performance sandboxing
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  define: {
    'import.meta.env.IS_TAURI': JSON.stringify(isTauri),
    'import.meta.env.IS_CAPACITOR': JSON.stringify(isCapacitor),
    'import.meta.env.IS_WEB': JSON.stringify(!isTauri && !isCapacitor),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  test: {
    // Base configurations shared across all projects
    globals: true,
    setupFiles: ['./src/shared/test/setup.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/shared/ui/**',
        '**/*.config.ts',
        '**/*.d.ts',
        '.storybook/**'
      ],
    },
    projects: [
      // Project 1: Our High-Speed Unit Tests (FSD Models, Logic, Zustand)
      {
        test: {
          name: 'unit',
          environment: 'happy-dom',
          // Target standard test files, excluding Storybook stories
          include: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
          exclude: ['src/**/*.stories.{ts,tsx}'],
        }
      },
      // Project 2: Your Existing Storybook UI Tests
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(dirname, '.storybook')
          })
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{
              browser: 'chromium'
            }]
          }
        }
      }
    ]
  }
});