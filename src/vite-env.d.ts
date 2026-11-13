/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL?: string;
  readonly VITE_CLASS_HASH?: string;
  readonly VITE_REGISTRY_ADDRESS?: string;
  readonly VITE_TARGET?: string;
  readonly VITE_KEYCHAIN_URL?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_PEPPER_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_SPONSOR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
