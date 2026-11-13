import { useState } from 'react';
import {
  REGISTRY_MAX_CLOCK_SKEW,
  REGISTRY_MAX_ENTRIES,
  newKeyPair,
  parseRegistryList,
  registryContentHash,
  registryMessageHash,
  signRegistryRequest,
  type RegistrySession,
} from '@kamui/sdk';
import { FEATURES } from '../lib/features';
import { TARGET } from '../lib/config';
import { Button, Callout, Card, Output, Section } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'registry')!;

function sample(origin = 'https://demo.example'): RegistrySession {
  const key = newKeyPair();
  return {
    publicKey: key.publicKey,
    validUntil: Math.floor(Date.now() / 1000) + 3600,
    maxCalls: 20,
    maxFeePerTx: '0x0',
    calls: [{ to: TARGET, entrypoint: 'ping' }],
    limits: [],
    origin,
    appName: 'Kamui demo',
  };
}

export function SessionRegistry() {
  const [out, setOut] = useState('Build a registry record, hash it, and parse a list — including a malformed one.');

  function run() {
    const session = sample();
    const content = registryContentHash(session);
    const account = '0xabc';
    const now = Math.floor(Date.now() / 1000);
    const request = {
      chainId: '0x534e5f5345504f4c4941',
      account,
      action: 'put' as const,
      timestamp: now,
      nonce: '0x1',
      subject: session.publicKey,
      session,
    };
    const message = registryMessageHash(request);
    const owner = newKeyPair();
    const signature = signRegistryRequest({
      ...request,
      ownerPrivateKey: owner.privateKey,
    });
    const good = parseRegistryList({
      sessions: [{ ...session, createdAt: now }],
    });
    const mixed = parseRegistryList({
      sessions: [
        { ...session, createdAt: now },
        { not: 'a session' },
        { ...sample(), createdAt: now, origin: 'x'.repeat(500) },
      ],
    });
    setOut(
      [
        'registryContentHash: ' + content,
        'registryMessageHash (put): ' + message,
        'owner signature: ' + signature.join(', '),
        '',
        'parseRegistryList of one well-shaped record: ' + good.length + ' kept.',
        'parseRegistryList of one good + two bad records: ' + mixed.length + ' kept (malformed and over-long origin dropped).',
        '',
        'Caps: ' + REGISTRY_MAX_ENTRIES + ' entries, clock skew ' + REGISTRY_MAX_CLOCK_SKEW + 's.',
        'The registry is a convenience, not an authority. What a record claims (the site, the calls, the limits) is only a claim. Check each session with reader.session(key).exists, read what it may do from the account, and show origin and appName as text.',
      ].join('\n'),
    );
  }

  return (
    <Section feature={feature}>
      <Callout>
        The account contract cannot enumerate its sessions, which is why a list is kept on a server. A device
        whose clock is more than five minutes off cannot list or record sessions.
      </Callout>
      <Card title="Hashes, signatures, untrusted input">
        <div className="actions">
          <Button variant="primary" onClick={run}>
            Hash a record and parse a mixed list
          </Button>
        </div>
        <Output>{out}</Output>
      </Card>
    </Section>
  );
}
