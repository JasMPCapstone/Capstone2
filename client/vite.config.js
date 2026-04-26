import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function proxyTo(target) {
  return {
    target,
    changeOrigin: true,
    cookieDomainRewrite: 'localhost',
  };
}

/**
 * During dev, the React app is served by Vite; same-origin API and auth flows
 * go to Express. Static assets under /public (e.g. favicon) must be proxied too.
 */
function expressAppProxies(apiTarget) {
  const p = proxyTo(apiTarget);
  return {
    '/api': p,
    '/login': p,
    '/logout': p,
    '/register': p,
    '/account': p,
    '/profile': p,
    '/settings': p,
    '/documents': p,
    '/admin': p,
    '/dashboard': p,
    '/help': p,
    '/company': p,
    '/privacy': p,
    '/forgot-password': p,
    '/reset-password': p,
    '/css': p,
    '/favicon.svg': p,
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const apiTarget = (env.VITE_PROXY_API || 'http://localhost:3000').replace(/\/$/, '');

  return {
    plugins: [react(), tailwindcss()],
    base: '/',
    server: {
      port: 5173,
      proxy: expressAppProxies(apiTarget),
    },
  };
});
