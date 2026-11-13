/** Public Sepolia values and optional live-service endpoints. Nothing here is a secret. */

export const SN_SEPOLIA = '0x534e5f5345504f4c4941';

/** Current Kamui account class, from kamui `services/backend/deployments.env`. */
export const CLASS_HASH =
  (import.meta.env.VITE_CLASS_HASH as string | undefined) ??
  '0x1e128dae2cb709cac9263afa1c6fdb33f7f1f5c2d969547d9739326d08399f6';

export const REGISTRY_ADDRESS =
  (import.meta.env.VITE_REGISTRY_ADDRESS as string | undefined) ??
  '0x4bc2b2afcce053e788511a851e6aeb004d18adb243df4fe852e1b727bd09808';

/** `Target` test contract on Sepolia (`contracts/src/mocks.cairo`): `ping()` and `count()`. */
export const TARGET =
  (import.meta.env.VITE_TARGET as string | undefined) ??
  '0x2f8ce9fcc5f6e165ab5dcccf865c4c08e7d752d6b930938195683eef9f43dfc';

export const STRK = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
export const ETH = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';

export const RPC_URL =
  (import.meta.env.VITE_RPC_URL as string | undefined) ??
  'https://starknet-sepolia-rpc.publicnode.com';

/** Empty unless a hosted Kamui keychain is configured at build time. */
export const KEYCHAIN_URL = (import.meta.env.VITE_KEYCHAIN_URL as string | undefined) ?? '';
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
export const PEPPER_URL = (import.meta.env.VITE_PEPPER_URL as string | undefined) ?? '';
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';
export const SPONSOR_URL = (import.meta.env.VITE_SPONSOR_URL as string | undefined) ?? '';

export const LIVE_KEYCHAIN = KEYCHAIN_URL.length > 0;
export const LIVE_LOGIN = Boolean(GOOGLE_CLIENT_ID && PEPPER_URL && API_URL && CLASS_HASH);
export const LIVE_SPONSOR = Boolean(SPONSOR_URL || API_URL);

export const APP_NAME = 'Kamui demo';

/** In-app demo keychain origin path (same site). */
export function demoKeychainUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/keychain`;
}

export function activeKeychainUrl(): string {
  return LIVE_KEYCHAIN ? KEYCHAIN_URL.replace(/\/$/, '') : demoKeychainUrl();
}

export function isDemoKeychain(): boolean {
  return !LIVE_KEYCHAIN;
}

export const KAMUI_COMMIT = 'a6e491c2a115ce5489ffbd6a45d93f3c1840afea';
