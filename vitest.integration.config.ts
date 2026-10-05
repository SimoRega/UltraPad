import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
export default defineConfig({ plugins: [cloudflareTest({ main: './tests/integration/worker.ts', miniflare: { compatibilityDate: '2026-08-15', compatibilityFlags: ['nodejs_compat'], durableObjects: { ROOMS: { className: 'TestRoom', useSQLite: true } } } })], test: { include: ['tests/integration/**/*.test.ts'] } });
