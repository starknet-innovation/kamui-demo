/** App-side helpers to start and finish a Kamui keychain connection. */
import {
  beginConnect,
  finishConnect,
  finishExecute,
  forgetConnection,
  loadConnection,
  pendingRequestKind,
  type Connection,
} from '@kamui/sdk';
import { APP_NAME, TARGET, activeKeychainUrl, connectRedirectUri, isDemoKeychain } from './config';

/** Create a ping()-scoped session and return the keychain URL to assign. */
export function startKamuiConnect(preferDemo = isDemoKeychain()): string {
  return beginConnect(
    {
      keychainUrl: activeKeychainUrl(preferDemo),
      redirectUri: connectRedirectUri(),
      appName: APP_NAME,
      validUntil: Math.floor(Date.now() / 1000) + 2 * 3600,
      maxCalls: 20,
      calls: [{ to: TARGET, entrypoint: 'ping' }],
    },
    sessionStorage,
  );
}

export type ReturnResult = {
  connection: Connection | null;
  message: string;
  tone: 'ok' | 'bad' | 'info';
};

/**
 * Consume a keychain answer in the URL fragment (connect or execute) and
 * return the current connection. Safe to call once on app load.
 */
export function consumeKeychainReturn(store: Storage = sessionStorage): ReturnResult {
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  const hadKamui = hash.includes('kamui=');
  try {
    if (pendingRequestKind(store) === 'execute') {
      try {
        const sent = finishExecute(hash, store);
        clearFragment();
        return {
          connection: loadConnection(store),
          message: sent
            ? 'The keychain approved a one-off call: ' + sent.transactionHash
            : 'Returned from the keychain with no execute answer.',
          tone: sent ? 'ok' : 'info',
        };
      } catch (error) {
        clearFragment();
        return {
          connection: loadConnection(store),
          message: 'One-off call not sent: ' + (error as Error).message,
          tone: 'bad',
        };
      }
    }
    const fresh = finishConnect(hash, store);
    if (fresh) {
      clearFragment();
      return {
        connection: fresh,
        message: isDemoKeychain()
          ? 'The in-app demo keychain returned a simulated approval. No session was registered on Sepolia.'
          : 'The Kamui keychain approved the session. Google sign-in, pepper and recovery (if needed) happened on the keychain.',
        tone: 'ok',
      };
    }
  } catch (error) {
    if (hadKamui) clearFragment();
    return {
      connection: loadConnection(store),
      message: 'Not connected: ' + (error as Error).message,
      tone: 'bad',
    };
  }
  if (hadKamui) clearFragment();
  const connection = loadConnection(store);
  return {
    connection,
    message: connection ? '' : '',
    tone: 'info',
  };
}

function clearFragment() {
  if (typeof history !== 'undefined' && typeof window !== 'undefined') {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

export function disconnectKamui(store: Storage = sessionStorage): void {
  forgetConnection(store);
}
