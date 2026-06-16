/// <reference types="vite-plus/client" />

interface ImportMetaEnv {
    readonly IS_TAURI: boolean
    readonly IS_CAPACITOR: boolean
    readonly IS_WEB: boolean
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
