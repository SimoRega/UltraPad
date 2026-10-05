import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig(({ mode }) => ({
  root: resolve(import.meta.dirname), envDir: resolve(import.meta.dirname, '../..'),
  plugins: [react()], resolve: { alias: { 'monaco-editor/esm/vs/editor/editor.api.js': 'monaco-editor/editor/editor.api.js' } }, server: { host: '127.0.0.1', port: 5173, fs: { allow: [resolve(import.meta.dirname, '../..')] } },
  optimizeDeps: { include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react-router-dom', '@tanstack/react-query', '@supabase/supabase-js', 'yjs', 'y-protocols/awareness', 'idb', 'jszip'], exclude: ['monaco-editor', 'y-monaco'], noDiscovery: false },
  build: { outDir: 'dist', chunkSizeWarningLimit: 4500 },
  define: { __BUILD_MODE__: JSON.stringify(mode), __CONFIGURED__: JSON.stringify(Boolean(loadEnv(mode, resolve(import.meta.dirname, '../..')).VITE_SUPABASE_URL)) }
}));
