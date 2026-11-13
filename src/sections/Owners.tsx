import { useState } from 'react';
import { MAX_OWNERS, addOwnerCall, newKeyPair, newOwnerMessageHash, removeOwnerCall, signNewOwner } from '@kamui/sdk';
import { FEATURES } from '../lib/features';
import { Button, Callout, Card, Output, Section } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'owners')!;

type Slot = { publicKey: string; privateKey?: string; label: string; isDevice?: boolean };

export function Owners() {
  const first = newKeyPair();
  const [slots, setSlots] = useState<Slot[]>([{ ...first, label: 'This device', isDevice: true }]);
  const [anchor, setAnchor] = useState(1n);
  const [account] = useState('0x1234abcd');
  const [log, setLog] = useState('Add and remove keys. A manual add on a full set is refused; recovery would replace the oldest.');
  const [tone, setTone] = useState<'ok' | 'bad' | undefined>();

  function add(kind: 'manual' | 'recover') {
    if (kind === 'manual' && slots.length >= MAX_OWNERS) {
      setTone('bad');
      setLog(
        'The contract returns an error: an owner adding a key by hand is refused when the set is full (5). A user who lost every device can still get back in: a recovery on a full set replaces the oldest key.',
      );
      return;
    }
    const key = newKeyPair();
    const signature = signNewOwner(account, anchor, key.privateKey);
    const call = addOwnerCall(account, key.publicKey, signature);
    const hash = newOwnerMessageHash(account, anchor);
    let next = [...slots, { publicKey: key.publicKey, privateKey: key.privateKey, label: kind === 'recover' ? 'Recovered device' : 'Added owner' }];
    let note = '';
    if (kind === 'recover' && slots.length >= MAX_OWNERS) {
      const removed = next[0]!;
      next = next.slice(1);
      note = '\nThe set was full: recovery replaced the oldest key ' + removed.publicKey.slice(0, 12) + '…';
    }
    setSlots(next);
    setAnchor((a) => a + 1n);
    setTone('ok');
    setLog(
      [
        'New key signed poseidon("StarkNet Message", "accept_ownership", account, anchor).',
        'anchor (before): ' + anchor.toString(),
        'message hash:    ' + hash,
        'signature:       ' + signature.join(', '),
        'add_owner call:  ' + call.entrypoint + ' at ' + call.contractAddress,
        'calldata felts:  ' + call.calldata?.length,
        'Every change of the owner set revokes every session and drops any pending override recovery.' + note,
      ].join('\n'),
    );
  }

  function remove(index: number) {
    if (slots.length <= 1) {
      setTone('bad');
      setLog('The last owner cannot be removed.');
      return;
    }
    const key = slots[index]!;
    const call = removeOwnerCall(account, key.publicKey);
    setSlots((s) => s.filter((_, i) => i !== index));
    setAnchor((a) => a + 1n);
    setTone('ok');
    const removedKey = Array.isArray(call.calldata) ? String(call.calldata[0]) : key.publicKey;
    setLog('remove_owner ' + removedKey + '\nSessions are revoked. New-owner signatures and recovery proofs bind to the new anchor, so an old proof cannot bring a removed key back.');
  }

  return (
    <Section feature={feature}>
      <Callout>
        Any owner key signs for the account, with a plain <code>[r, s]</code> signature. At most{' '}
        {MAX_OWNERS} keys, one per device. Recovery proofs and new-owner signatures are bound to an anchor
        that changes with every change of the set.
      </Callout>
      <Card title={`Owner set (anchor ${anchor})`}>
        <div className="owners" data-owners={slots.length}>
          {Array.from({ length: MAX_OWNERS }, (_, i) => {
            const slot = slots[i];
            return (
              <div key={i} className={`owner-slot ${slot ? 'filled' : ''} ${slot?.isDevice ? 'device' : ''}`}>
                <div className="idx">{slot ? slot.label : 'Empty'}</div>
                <div className="key">{slot ? slot.publicKey.slice(0, 8) + '…' + slot.publicKey.slice(-6) : '—'}</div>
                {slot && !slot.isDevice ? (
                  <Button onClick={() => remove(i)}>Remove</Button>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="actions">
          <Button variant="primary" onClick={() => add('manual')}>
            Add a key (owner)
          </Button>
          <Button onClick={() => add('recover')}>Login on a new device (recover)</Button>
        </div>
        <Output tone={tone}>{log}</Output>
      </Card>
    </Section>
  );
}
