/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Admin gate password (dev-only convenience; server side is authoritative in production) */
  readonly VITE_ADMIN_PASSWORD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
