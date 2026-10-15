import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { API_URL, LOCAL_API, isSiteMode } from './src/shared/config/sites'

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

  function checkEnv(mode: string) {
    if (!isSiteMode(mode)) {
      throw new Error(`unknown mode "${mode}", expected: ${Object.keys(API_URL).join(', ')}`)
    }
    const key = mode === 'development' ? 'VITE_TELEGRAM_BOT_LOCAL' : 'VITE_TELEGRAM_BOT'
    if (!loadEnv(mode, process.cwd(), 'VITE_')[key]) {
      throw new Error(`${key} is not set — add it to .env (see .env.example)`)
    }
  }

  export default defineConfig(({ mode }) => {
    checkEnv(mode)
    return {
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
      proxy: {
        '/api': {
          target: process.env.API_PROXY_TARGET ?? LOCAL_API,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },

    optimizeDeps: { include: ['react', 'react-dom/client'] },
  }
})
