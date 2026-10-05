import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { developmentTarget } from '../../packages/contracts/src/api-endpoint.ts';
export default defineConfig(({ mode }) => {
  const root=resolve(import.meta.dirname,'../..');
  const variables=loadEnv(mode,root);
  const target=developmentTarget(variables.VITE_API_URL ?? 'http://127.0.0.1:8787');
  return {
    root: resolve(import.meta.dirname), envDir: root, cacheDir: resolve(root,'node_modules/.vite/web'),
    plugins: [react()],
    resolve: { alias: { 'monaco-editor/esm/vs/editor/editor.api.js': 'monaco-editor/editor/editor.api.js' } },
    server: {
      host: '127.0.0.1', port: 5173, strictPort: true, fs: { allow: [root] },
      proxy: target ? { '/api': {
        target, ws: true, rewrite: path=>path.replace(/^\/api(?=\/|$)/,''),
        configure(proxy) {
          proxy.on('error',(_error,_request,response)=>{
            if('writeHead' in response && !response.headersSent) {
              response.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});
              response.end(JSON.stringify({error:'API_UNAVAILABLE'}));
            }
          });
        }
      } } : undefined
    },
    optimizeDeps: { include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react-router-dom', '@tanstack/react-query', '@supabase/supabase-js', 'yjs', 'y-protocols/awareness', 'idb', 'jszip', 'quill', 'quill-cursors'], exclude: ['monaco-editor', 'y-monaco', 'y-quill'], noDiscovery: false },
    build: { outDir: 'dist', chunkSizeWarningLimit: 4500 },
    define: { __BUILD_MODE__: JSON.stringify(mode), __CONFIGURED__: JSON.stringify(Boolean(variables.VITE_SUPABASE_URL)) }
  };
});
