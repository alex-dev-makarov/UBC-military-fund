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

  function checkDeployEnv(mode: string, command: string) {
    if (command !== 'build' || mode === 'development') return
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const problems: string[] = []
    if (!env.VITE_API_URL?.startsWith('https://')) problems.push(`VITE_API_URL must be https://…, got "${env.VITE_API_URL ?? ''}"`)
    if (!env.VITE_TELEGRAM_BOT || /REPLACE|your_bot/i.test(env.VITE_TELEGRAM_BOT)) {
      problems.push(`VITE_TELEGRAM_BOT is not set for mode "${mode}"`)
    }
    if (problems.length) throw new Error(`.env.${mode}:\n  - ${problems.join('\n  - ')}`)
  }

  export default defineConfig(({ mode, command }) => {
    checkDeployEnv(mode, command)
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
          target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },

    optimizeDeps: { include: ['react', 'react-dom/client'] },
  }
})
