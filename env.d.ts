/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ID: string
  readonly VITE_REDIRECT_URI: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
