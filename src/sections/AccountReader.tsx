import { useState } from 'react';
import { KamuiReader, SESSION_KEY_INTERFACE_ID, SRC6_ID, SRC9_V2_ID } from '@kamui/sdk';
import { RpcProvider } from 'starknet';
import { FEATURES } from '../lib/features';
import { RPC_URL } from '../lib/config';
import { Button, Callout, Card, Field, Output, Section } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'reader')!;

/** An account from the 2026-11-12 Sepolia runs. It may be an earlier class than the current one. */
const EXAMPLE = '0x3ec3b3ead6762ecf0172e0d5e3f9df472e66608e3f483f300a784dc9652d193';

export function AccountReader() {
  const [address, setAddress] = useState(EXAMPLE);
  const [out, setOut] = useState('Paste a Kamui account and read it on Sepolia.');
  const [tone, setTone] = useState<'ok' | 'bad' | undefined>();
  const [busy, setBusy] = useState(false);

  async function read() {
    setBusy(true);
    try {
      const provider = new RpcProvider({ nodeUrl: RPC_URL });
      const reader = new KamuiReader(provider, address);
      const deployed = await reader.isDeployed();
      if (!deployed) {
        setTone('bad');
        setOut('No contract at this address on Sepolia (or the node reported CONTRACT_NOT_FOUND).');
        setBusy(false);
        return;
      }
      const [owners, anchor, epoch, identity, src6, src9, session] = await Promise.all([
        reader.owners(),
        reader.ownersAnchor(),
        reader.sessionEpoch(),
        reader.identity(),
        reader.supportsInterface(SRC6_ID),
        reader.supportsInterface(SRC9_V2_ID),
        reader.supportsInterface(SESSION_KEY_INTERFACE_ID),
      ]);
      setTone('ok');
      setOut(
        [
          'deployed:        yes',
          'identity:        ' + identity,
          'owners anchor:   ' + anchor,
          'session epoch:   ' + epoch,
          'owners (' + owners.length + '):',
          ...owners.map((o, i) => '  ' + (i + 1) + '. ' + o),
          '',
          'supports SRC-6 (account):          ' + String(src6),
          'supports SRC-9 v2 (outside exec):  ' + String(src9),
          'supports session-key interface:    ' + String(session),
        ].join('\n'),
      );
    } catch (error) {
      setTone('bad');
      setOut('Read failed: ' + (error as Error).message);
    }
    setBusy(false);
  }

  return (
    <Section feature={feature}>
      <Callout>
        <code>KamuiReader</code> is a read-only view: owners, the anchor, the session epoch, session data and
        scope, spending policies, and nonces. This section calls a public Sepolia RPC. The example address is
        from the November 2026 live runs; a newer class hash would be a different address for the same user.
      </Callout>
      <Card title="Read an account">
        <Field label="Account address">
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <div className="actions">
          <Button variant="primary" onClick={() => void read()} disabled={busy}>
            {busy ? 'Reading…' : 'Read on Sepolia'}
          </Button>
        </div>
        <Output tone={tone}>{out}</Output>
      </Card>
    </Section>
  );
}
