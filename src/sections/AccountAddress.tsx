import { useMemo, useState } from 'react';
import { accountAddress, accountAddressFromLogin, constructorCalldata, identity, NO_PEPPER } from '@kamui/sdk';
import { FEATURES } from '../lib/features';
import { CLASS_HASH } from '../lib/config';
import { Button, Callout, Card, Field, Output, Section } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'address')!;

export function AccountAddress() {
  const [iss, setIss] = useState('https://accounts.google.com');
  const [aud, setAud] = useState('kamui-demo.apps.googleusercontent.com');
  const [sub, setSub] = useState('demo-user-0001');
  const [pepper, setPepper] = useState('0x1234');
  const [classHash, setClassHash] = useState(CLASS_HASH);
  const [out, setOut] = useState('Fill in claims and a pepper, then compute.');

  const computed = useMemo(() => {
    try {
      const id = identity({ iss, aud, sub }, pepper);
      const address = accountAddress(classHash, aud, id);
      const same = accountAddressFromLogin(classHash, { iss, aud, sub }, pepper);
      const ctor = constructorCalldata(aud, id);
      return { ok: true as const, id, address, same, ctor, zero: pepper === NO_PEPPER || BigInt(pepper) === 0n };
    } catch (error) {
      return { ok: false as const, error: (error as Error).message };
    }
  }, [iss, aud, sub, pepper, classHash]);

  function show() {
    if (!computed.ok) {
      setOut(computed.error);
      return;
    }
    setOut(
      [
        'identity = poseidon(iss, aud, sub, pepper)',
        computed.id,
        '',
        'account address (UDC from zero, salt = identity, ctor = (aud, identity))',
        computed.address,
        'accountAddressFromLogin agrees: ' + String(computed.same === computed.address),
        '',
        'constructor calldata (' + computed.ctor.length + ' felts):',
        computed.ctor.join('\n'),
        '',
        computed.zero
          ? 'WARNING: pepper is 0 (NO_PEPPER). Anyone who knows the user’s sub can find this account. Testnets only.'
          : 'Pepper is non-zero: the address cannot be found from iss/aud/sub alone.',
        'Kamui accounts are not upgradeable. A new class hash means a new address for the same login.',
      ].join('\n'),
    );
  }

  return (
    <Section feature={feature}>
      <Callout>
        The derivation is the one in social-account: <code>identity = h(iss, aud, sub, pepper)</code>, address ={' '}
        <code>udc_address(class, salt = identity, from_zero, [aud, identity])</code>. The pepper must be the same
        for every <code>aud</code>.
      </Callout>
      <Card title="Compute an address from login claims">
        <div className="row">
          <Field label="iss">
            <input value={iss} onChange={(e) => setIss(e.target.value)} />
          </Field>
          <Field label="aud">
            <input value={aud} onChange={(e) => setAud(e.target.value)} />
          </Field>
          <Field label="sub">
            <input value={sub} onChange={(e) => setSub(e.target.value)} />
          </Field>
          <Field label="pepper">
            <input value={pepper} onChange={(e) => setPepper(e.target.value)} />
          </Field>
        </div>
        <Field label="class hash">
          <input value={classHash} onChange={(e) => setClassHash(e.target.value)} />
        </Field>
        <div className="actions">
          <Button variant="primary" onClick={show}>
            Compute identity and address
          </Button>
          <Button
            onClick={() => {
              setPepper(NO_PEPPER);
            }}
          >
            Use NO_PEPPER (0)
          </Button>
        </div>
        <Output tone={computed.ok ? 'ok' : 'bad'}>{out}</Output>
      </Card>
    </Section>
  );
}
