import { useState } from 'react';
import { loadConnection, sessionCall, sponsor } from '@kamui/sdk';
import { RpcProvider } from 'starknet';
import { FEATURES } from '../lib/features';
import { LIVE_SPONSOR, RPC_URL, SPONSOR_URL, TARGET, isDemoKeychain } from '../lib/config';
import { Button, Callout, Card, Output, Section } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'sponsored')!;

export function SponsoredCalls() {
  const [log, setLog] = useState('Connect with Kamui first, then prepare a ping. Sending it needs a sponsor server.');
  const [tone, setTone] = useState<'ok' | 'bad' | undefined>();
  const [busy, setBusy] = useState(false);
  const connection = typeof sessionStorage === 'undefined' ? null : loadConnection(sessionStorage);

  async function ping() {
    const conn = loadConnection(sessionStorage);
    if (!conn) {
      setTone('bad');
      setLog('No connection. Use “Connect with Kamui (Google)” in the header first.');
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
          'This GitHub Pages site is static: it cannot hold the private sponsor token that',
          "kamui's apps/demo-dapp/server.ts injects as x-kamui-sponsor-token on /api/sponsor.",
          'The hosted keychain itself has no public /sponsor (POST https://sepolia.kamui.page/sponsor returns 404).',
          'To send a real ping, run a small backend (the demo-dapp server is the reference) with',
          'SPONSOR_SERVER_TOKEN and point VITE_SPONSOR_URL at that proxy.',
          'Target contract: ' + TARGET,
          SPONSOR_URL ? 'Sponsor URL: ' + SPONSOR_URL : 'No VITE_SPONSOR_URL — sponsored send is labeled, not live.',
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
      <Callout tone="warn">
        After a session is approved, the app signs with the session key and would POST{' '}
        <code>execute_from_outside_v2</code> to a sponsor gateway. Kamui’s reference demo-dapp does that
        through a <strong>local server</strong> that injects a private <code>SPONSOR_SERVER_TOKEN</code>.
        A static GitHub Pages site cannot do that, and <code>https://sepolia.kamui.page/sponsor</code> is
        not a public gateway (404). Connect and session display work here; one-off execute still goes
        through the keychain (the keychain submits the transaction itself). This Ping button is labeled
        and explains the missing server, unless you set <code>VITE_SPONSOR_URL</code> to your own proxy.
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
            {busy ? 'Sending…' : LIVE_SPONSOR && !isDemoKeychain() ? 'Send a sponsored ping' : 'Prepare a sponsored ping (needs a sponsor server)'}
          </Button>
        </div>
        <Output tone={tone}>{log}</Output>
      </Card>
    </Section>
  );
}
