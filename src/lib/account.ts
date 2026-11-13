/** Current account for one-off execute inspection and account-targeted calls. */
import { loadConnection } from '@kamui/sdk';
import { DEMO_ACCOUNT, LIVE_KEYCHAIN } from './config';

/**
 * The account identity execute inspection and add-owner requests should use.
 * A hosted keychain uses the currently connected account when one exists;
 * otherwise (and always in demo-keychain mode) this is DEMO_ACCOUNT.
 * Call this from click handlers so a connect or disconnect is not stale.
 */
export function resolveExecuteAccount(
  liveKeychain: boolean,
  connectedAccount: string | undefined | null,
): string {
  const account = connectedAccount?.trim();
  if (liveKeychain && account) return account;
  return DEMO_ACCOUNT;
}

/** Fresh read of the connected account from sessionStorage. Safe to call in a click handler. */
export function currentExecuteAccount(): string {
  const connected =
    typeof sessionStorage !== 'undefined' ? loadConnection(sessionStorage)?.account : undefined;
  return resolveExecuteAccount(LIVE_KEYCHAIN, connected);
}
