/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VVIZ_DEFAULT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
