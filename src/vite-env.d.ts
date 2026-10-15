interface ImportMetaEnv {
  readonly VITE_TELEGRAM_BOT: string
  readonly VITE_TELEGRAM_BOT_LOCAL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
