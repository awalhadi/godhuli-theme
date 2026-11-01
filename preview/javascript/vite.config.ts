/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const isBuild = command === 'build';
  const apiTarget = env.VITE_API_URL ?? 'http://localhost:3000';

  const plugins: PluginOption[] = [react({ babel: { plugins: [] } })];
  if (process.env.ANALYZE === 'true') {
    plugins.push(visualizer({ filename: 'dist/stats.html', gzipSize: true }) as PluginOption);
  }

  return {
    base: isBuild ? '/static/' : '/',
    plugins,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '~icons': fileURLToPath(new URL('./src/assets/icons', import.meta.url)),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __DEV__: !isBuild,
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      target: 'es2022',
      sourcemap: mode !== 'production' ? 'inline' : false,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // TODO: revisit chunking once the admin bundle is split out
          manualChunks: { react: ['react', 'react-dom'], charts: ['recharts'] },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      coverage: { provider: 'v8', thresholds: { lines: 80, branches: 70 } },
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  };
});
