import { defineConfig, loadEnv, type Plugin } from 'vite'
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

  // All site settings live here. The only thing outside git is the bot names in .env.
  const API_URL: Record<string, string> = {
    development: '/api',
    dev: 'https://api-dev.ubc-military-fund.com',
    production: 'https://api.ubc-military-fund.com',
  }
  const LOCAL_API = 'http://localhost:3001'

  function siteEnv(mode: string) {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const apiUrl = API_URL[mode]
    const bot = mode === 'development' ? env.VITE_TELEGRAM_BOT_LOCAL : env.VITE_TELEGRAM_BOT
    if (!apiUrl) throw new Error(`unknown mode "${mode}", expected: ${Object.keys(API_URL).join(', ')}`)
    if (!bot) {
      const key = mode === 'development' ? 'VITE_TELEGRAM_BOT_LOCAL' : 'VITE_TELEGRAM_BOT'
      throw new Error(`${key} is not set — add it to .env (see .env.example)`)
    }
    return { apiUrl, bot }
  }

  export default defineConfig(({ mode }) => {
    const { apiUrl, bot } = siteEnv(mode)
    return {
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
      'import.meta.env.VITE_TELEGRAM_BOT': JSON.stringify(bot),
    },

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
