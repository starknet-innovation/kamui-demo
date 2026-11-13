/** Public Sepolia values and optional live-service endpoints. Nothing here is a secret. */
import { resolveSponsorUrl } from './parse';

/** Simulated account returned by the in-app demo keychain. */
export const DEMO_ACCOUNT = '0xde0000000000000000000000000000000000000000000000000000000000001';

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

/**
 * Live pepper service (`GET /health` returns ok). Requests from this demo's origin are
 * currently refused (`ORIGIN_NOT_ALLOWED`). Override with `VITE_PEPPER_URL`, or set it
 * to empty to skip the call.
 */
export const DEFAULT_PEPPER_URL = 'https://pepper-sepolia.kamui.page';
export const PEPPER_URL = (import.meta.env.VITE_PEPPER_URL as string | undefined) ?? DEFAULT_PEPPER_URL;

/** Public Google OAuth Web client ID (not a secret). `VITE_GOOGLE_CLIENT_ID` overrides when set and non-empty. */
export const DEFAULT_GOOGLE_CLIENT_ID =
  '612906135098-gclndmmib7jnn6hhj5p55akei3kjtbdv.apps.googleusercontent.com';
export const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || DEFAULT_GOOGLE_CLIENT_ID;

/** Explicit gateway, or `{API_URL}/sponsor` when only the API is configured. */
export const SPONSOR_URL = resolveSponsorUrl(
  (import.meta.env.VITE_SPONSOR_URL as string | undefined) ?? '',
  API_URL,
);

export const LIVE_KEYCHAIN = KEYCHAIN_URL.length > 0;
export const LIVE_SPONSOR = SPONSOR_URL.length > 0;
export const LIVE_PEPPER = PEPPER_URL.length > 0;
export const LIVE_GOOGLE = GOOGLE_CLIENT_ID.length > 0;

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

/**
 * Exact OAuth `redirect_uri` for Google. Must match the Cloud console entry:
 *   `http://localhost:5175/callback`
 *   `https://starknet-innovation.github.io/kamui-demo/callback`
 *
 * Vite's `BASE_URL` is `/` locally and `/kamui-demo/` on Pages (always with a trailing slash).
 */
export function loginRedirectUri(
  origin: string = typeof window !== 'undefined' ? window.location.origin : '',
  base: string = import.meta.env.BASE_URL,
): string {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${origin}${prefix}callback`;
}

/** True for `/callback` and `/kamui-demo/callback` (with or without a trailing slash). */
export function isLoginCallbackPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '');
  return path === '/callback' || path.endsWith('/callback');
}

export const KAMUI_COMMIT = 'a6e491c2a115ce5489ffbd6a45d93f3c1840afea';
