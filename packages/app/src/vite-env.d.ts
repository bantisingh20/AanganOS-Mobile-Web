/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ONESIGNAL_APP_ID?: string;
  readonly VITE_DEVICE_REGISTER_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
