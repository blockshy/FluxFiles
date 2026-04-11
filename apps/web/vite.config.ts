import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const buildVersion = new Date().toISOString();

  return {
    base: '/fluxfiles/',
    define: {
      __APP_VERSION__: JSON.stringify(buildVersion),
    },
    appType: 'spa',
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            antd: ['antd', '@ant-design/icons'],
            query: ['@tanstack/react-query', 'axios'],
          },
        },
      },
    },
    plugins: [
      react(),
      {
        name: 'fluxfiles-version-manifest',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify({ version: buildVersion }),
          });
        },
      },
    ],
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  };
});
