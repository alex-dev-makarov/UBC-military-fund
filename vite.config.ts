import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url))

function preloadFont(): Plugin {
  return {
    name: 'preload-font',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(_html, ctx) {
      const file = Object.keys(ctx.bundle ?? {}).find((name) => name.endsWith('.woff2'))
      if (!file) return

      return [
        {
          tag: 'link',
          attrs: {
            rel: 'preload',
            as: 'font',
            type: 'font/woff2',
            href: `/${file}`,
            crossorigin: '',
          },
          injectTo: 'head',
        },
      ]
    },
  }
}

export default defineConfig({
  plugins: [
    react({
      babel: { plugins: [['babel-plugin-react-compiler', {}]] },
    }),
    tailwindcss(),
    preloadFont(),
  ],

  resolve: {
    alias: {
      '@app': src('app'),
      '@pages': src('pages'),
      '@widgets': src('widgets'),
      '@features': src('features'),
      '@entities': src('entities'),
      '@shared': src('shared'),
      '@assets': src('assets'),
    },
  },

  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks: (id) =>
          id.includes('/node_modules/react') || id.includes('/node_modules/scheduler')
            ? 'react'
            : undefined,
      },
    },
  },

  esbuild: {
    drop: ['console', 'debugger'],
    legalComments: 'none',
  },

  server: {
    warmup: { clientFiles: ['./src/main.tsx', './src/app*.tsx', './src/pages*.tsx'] },
    
    
    
    
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io'],
    
    
    
    
    
    
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  optimizeDeps: { include: ['react', 'react-dom/client'] },
})
