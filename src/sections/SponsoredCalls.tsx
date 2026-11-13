import { useState } from 'react';
import { loadConnection, sessionCall, sponsor } from '@kamui/sdk';
import { RpcProvider } from 'starknet';
import { FEATURES } from '../lib/features';
import { LIVE_SPONSOR, RPC_URL, SPONSOR_URL, TARGET, isDemoKeychain } from '../lib/config';
import { Button, Callout, Card, Output, Section } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'sponsored')!;

export function SponsoredCalls() {
  const [log, setLog] = useState('Connect in the Keychain section first, then ping.');
  const [tone, setTone] = useState<'ok' | 'bad' | undefined>();
  const [busy, setBusy] = useState(false);
  const connection = typeof sessionStorage === 'undefined' ? null : loadConnection(sessionStorage);

  async function ping() {
    const conn = loadConnection(sessionStorage);
    if (!conn) {
      setTone('bad');
      setLog('No connection. Approve a session in “Keychain connect” first.');
      return;
    }
    if (isDemoKeychain() || !LIVE_SPONSOR) {
      setTone(undefined);
      setLog(
        [
          'A live ping needs a session that exists on chain and a sponsor gateway.',
          'In production the app would now:',
          '  1. sessionCall(connection, [{ ping() }], provider)',
          '     — reads the next reserved session nonce and builds sessionOutsideExecution',
          '  2. sponsor(url, prepared.call)',
          '     — POST { account, calldata } to the backend’s /sponsor (or an approved-app proxy)',
          '  3. wait for the transaction, then read Target.count()',
          '',
          'The in-app demo keychain does not register a session, and no sponsor URL is configured.',
          'Set VITE_KEYCHAIN_URL and VITE_SPONSOR_URL (or VITE_API_URL) against a funded Sepolia deployment to send a real ping.',
          'Target contract: ' + TARGET,
          SPONSOR_URL ? 'Sponsor URL: ' + SPONSOR_URL : 'No VITE_SPONSOR_URL.',
        ].join('\n'),
      );
      return;
    }
    setBusy(true);
    try {
      const provider = new RpcProvider({ nodeUrl: RPC_URL });
      const prepared = await sessionCall(conn, [{ contractAddress: TARGET, entrypoint: 'ping', calldata: [] }], provider);
      if (!prepared) throw new Error('the session has used all its calls');
      const start = performance.now();
      const tx = await sponsor(SPONSOR_URL, prepared.call);
      setLog('sent ' + tx + ' — waiting…');
      await provider.waitForTransaction(tx);
      const count = await provider.callContract({ contractAddress: TARGET, entrypoint: 'count', calldata: [] });
      setTone('ok');
      setLog(
        'Confirmed ' + tx + ' in ' + ((performance.now() - start) / 1000).toFixed(1) + 's. Target.count() = ' + BigInt(count[0]!),
      );
    } catch (error) {
      setTone('bad');
      setLog((error as Error).message);
    }
    setBusy(false);
  }

  return (
    <Section feature={feature}>
      <Callout>
        After a session is approved, the keychain is not involved again. The HTTP <code>sponsor</code> helper
        posts to Kamui’s <code>/sponsor</code> gateway. The backend may use its development relayer or an
        optional AVNU paymaster (Sepolia-only, not tested live). No paymaster credential is added to the
        browser. Approved-app sponsorship uses a server-side token, never a public page.
      </Callout>
      <Card title="Ping the Sepolia Target contract">
        <p>
          {connection
            ? 'A session key is in this tab for ' + connection.account + '.'
            : 'No session in this tab yet.'}{' '}
          The original Kamui ping demo asked for a session limited to <code>ping()</code> on{' '}
          <code>{TARGET.slice(0, 10)}…</code>.
        </p>
        <div className="actions">
          <Button variant="primary" onClick={() => void ping()} disabled={busy}>
            {busy ? 'Sending…' : 'Prepare / send a sponsored ping'}
          </Button>
        </div>
        <Output tone={tone}>{log}</Output>
      </Card>
    </Section>
  );
}
