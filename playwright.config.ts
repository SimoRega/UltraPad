import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/e2e', testMatch: '**/*.spec.ts', use: { baseURL: 'http://localhost:5173' }, webServer: [
 { command: 'pnpm dev:web', env: { VITE_SUPABASE_URL:'http://localhost:8788', VITE_SUPABASE_ANON_KEY:'test-only-key', VITE_API_URL:'http://localhost:8788' }, url: 'http://localhost:5173', reuseExistingServer: !process.env.CI },
 { command: 'pnpm exec vite --config tests/e2e/vite.config.ts', url: 'http://localhost:5174', reuseExistingServer: !process.env.CI },
 { command: 'pnpm exec wrangler dev --config tests/e2e/wrangler.jsonc --ip 127.0.0.1 --port 8788 --inspector-port 9233 --persist-to .wrangler/e2e', url: 'http://localhost:8788', reuseExistingServer: !process.env.CI }
] });
