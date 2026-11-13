import { describe, expect, it, beforeEach } from 'vitest';
import { beginConnect, toFragment, type Connection } from '@kamui/sdk';
import {
  API_URL,
  DEFAULT_API_URL,
  DEFAULT_KEYCHAIN_URL,
  KEYCHAIN_URL,
  LIVE_KEYCHAIN,
  LIVE_SPONSOR,
  SPONSOR_URL,
  activeKeychainUrl,
  connectRedirectUri,
  isDemoKeychain,
  preferDemoKeychain,
  setPreferDemoKeychain,
} from '../src/lib/config';
import { consumeKeychainReturn } from '../src/lib/connect';

describe('hosted keychain defaults', () => {
  it('points KEYCHAIN_URL and API_URL at sepolia.kamui.page', () => {
    expect(DEFAULT_KEYCHAIN_URL).toBe('https://sepolia.kamui.page');
    expect(DEFAULT_API_URL).toBe('https://sepolia.kamui.page');
    expect(KEYCHAIN_URL).toBe(DEFAULT_KEYCHAIN_URL);
    expect(API_URL).toBe(DEFAULT_API_URL);
    expect(LIVE_KEYCHAIN).toBe(true);
  });

  it('does not treat the keychain host as a live sponsor gateway', () => {
    expect(SPONSOR_URL).toBe('');
    expect(LIVE_SPONSOR).toBe(false);
  });

  it('uses the hosted keychain unless the demo toggle is on', () => {
    sessionStorage.clear();
    expect(preferDemoKeychain()).toBe(false);
    expect(isDemoKeychain()).toBe(false);
    expect(activeKeychainUrl()).toBe('https://sepolia.kamui.page');
    setPreferDemoKeychain(true);
    expect(preferDemoKeychain()).toBe(true);
    expect(isDemoKeychain()).toBe(true);
    expect(activeKeychainUrl()).toMatch(/\/keychain$/);
    setPreferDemoKeychain(false);
    expect(activeKeychainUrl()).toBe('https://sepolia.kamui.page');
  });
});

describe('connectRedirectUri', () => {
  it('is the Pages site base, with no fragment', () => {
    expect(connectRedirectUri('https://starknet-innovation.github.io', '/kamui-demo/')).toBe(
      'https://starknet-innovation.github.io/kamui-demo/',
    );
  });

  it('is http://localhost:5175/ in local dev (http is only allowed on localhost)', () => {
    expect(connectRedirectUri('http://localhost:5175', '/')).toBe('http://localhost:5175/');
  });

  it('adds a trailing slash when the Vite base is missing one', () => {
    expect(connectRedirectUri('https://example.com', '/app')).toBe('https://example.com/app/');
  });
});

describe('beginConnect URL', () => {
  it('sends the user to the hosted keychain /connect with a redirect back to this app', () => {
    const store: Storage = sessionStorage;
    store.clear();
    const url = beginConnect(
      {
        keychainUrl: 'https://sepolia.kamui.page',
        redirectUri: 'https://starknet-innovation.github.io/kamui-demo/',
        appName: 'Kamui demo',
        validUntil: 2_000_000_000,
        maxCalls: 20,
        calls: [{ to: '0x1', entrypoint: 'ping' }],
      },
      store,
    );
    expect(url.startsWith('https://sepolia.kamui.page/connect#kamui=')).toBe(true);
    const payload = new URLSearchParams(new URL(url).hash.replace(/^#/, '')).get('kamui');
    expect(payload).toBeTruthy();
    const b64 = payload!.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const decoded = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))));
    expect(decoded.redirectUri).toBe('https://starknet-innovation.github.io/kamui-demo/');
    expect(decoded.session.calls).toEqual([{ to: '0x1', entrypoint: 'ping' }]);
    expect(store.getItem('kamui.pending')).toBeTruthy();
  });
});

describe('consumeKeychainReturn', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('loads an existing connection when there is no fragment', () => {
    const connection: Connection = {
      account: '0xabc',
      chainId: '0x1',
      classHash: '0x2',
      session: { privateKey: '0x3', publicKey: '0x4', validUntil: 2_000_000_000, maxCalls: 20 },
    };
    sessionStorage.setItem('kamui.connection', JSON.stringify(connection));
    const result = consumeKeychainReturn();
    expect(result.connection?.account).toBe('0xabc');
    expect(result.message).toBe('');
  });

  it('finishes a matching connect answer in the hash and clears the fragment', () => {
    const store = sessionStorage;
    beginConnect(
      {
        keychainUrl: 'https://sepolia.kamui.page',
        redirectUri: 'http://localhost:5175/',
        appName: 'Kamui demo',
        validUntil: 2_000_000_000,
        maxCalls: 20,
        calls: [{ to: '0x1', entrypoint: 'ping' }],
      },
      store,
    );
    // Reuse the pending id the SDK stored, and craft a successful answer.
    const pending = JSON.parse(store.getItem('kamui.pending')!);
    const answer = toFragment({
      v: 1,
      id: pending.id,
      ok: true,
      account: '0x123',
      chainId: '0x534e5f5345504f4c4941',
      classHash: '0xabc',
    } as never);
    window.history.replaceState(null, '', '/' + answer);
    // location.hash is derived from the current href in jsdom/happy-dom.
    const result = consumeKeychainReturn(store);
    expect(result.connection?.account).toBe('0x123');
    expect(result.tone).toBe('ok');
    expect(result.message).toMatch(/approved the session/);
    expect(window.location.hash).not.toMatch(/kamui=/);
  });
});
