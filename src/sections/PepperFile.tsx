import { useState } from 'react';
import {
  accountAddressFromLogin,
  exportPepper,
  parsePepperFile,
  pepperFileMatchesLogin,
  pepperFromFile,
  serializePepperFile,
  type LoginClaims,
} from '@kamui/sdk';
import { FEATURES } from '../lib/features';
import { CLASS_HASH, SN_SEPOLIA } from '../lib/config';
import { Button, Callout, Card, Field, Output, Section } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'pepper')!;

const SAMPLE_CLAIMS: LoginClaims = {
  iss: 'https://accounts.google.com',
  aud: 'kamui-demo.apps.googleusercontent.com',
  sub: 'demo-user-0001',
};

function randomPepper(): bigint {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  bytes[0] &= 0x03; // keep it under 2^250
  let n = 0n;
  for (const b of bytes) n = (n << 8n) + BigInt(b);
  return n === 0n ? 1n : n;
}

export function PepperFileSection() {
  const [claims] = useState(SAMPLE_CLAIMS);
  const [fileText, setFileText] = useState('');
  const [message, setMessage] = useState('Export a file, then parse it or try it against matching and foreign claims.');
  const [tone, setTone] = useState<'ok' | 'bad' | undefined>();
  const [sub, setSub] = useState(SAMPLE_CLAIMS.sub);

  function exportFile() {
    const pepper = randomPepper();
    const file = exportPepper({
      chainId: SN_SEPOLIA,
      classHash: CLASS_HASH,
      claims,
      pepper,
      keyVersion: 1,
    });
    const text = serializePepperFile(file);
    setFileText(text);
    setTone('ok');
    setMessage(
      [
        'Exported a kamui-pepper v1 file.',
        'account (computed, includes sub): ' + file.account,
        'iss: ' + file.iss,
        'aud: ' + file.aud,
        'sub is NOT in the file (used only to compute the address).',
        'pepper: ' + file.pepper,
        'keyVersion: ' + file.keyVersion,
        'Whoever holds this file learns the account address. It gives no access: recovery still needs a login token and a proof.',
      ].join('\n'),
    );
  }

  function download() {
    if (!fileText) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([fileText], { type: 'application/json' }));
    link.download = 'kamui-pepper.json';
    link.click();
  }

  function parse() {
    try {
      const file = parsePepperFile(fileText);
      const match = pepperFileMatchesLogin(file, { ...claims, sub }, SN_SEPOLIA);
      let fromFile: string | undefined;
      try {
        fromFile = pepperFromFile(file, { ...claims, sub }, SN_SEPOLIA, CLASS_HASH).pepper;
      } catch (error) {
        fromFile = 'refused: ' + (error as Error).message;
      }
      setTone(match ? 'ok' : 'bad');
      setMessage(
        [
          'parsePepperFile: ok',
          'kind: ' + file.kind + '  version: ' + file.version,
          'account: ' + file.account,
          'recomputed address from token claims + file pepper: ' +
            accountAddressFromLogin(file.classHash, { iss: file.iss, aud: file.aud, sub }, file.pepper),
          'pepperFileMatchesLogin (chain, iss, aud, address): ' + String(match),
          'pepperFromFile: ' + fromFile,
          match
            ? 'This file belongs to these claims. A login may take the pepper from it instead of asking the service.'
            : 'This file is for another user, application, class or network — or the sub does not match. The SDK refuses to use it.',
        ].join('\n'),
      );
    } catch (error) {
      setTone('bad');
      setMessage((error as Error).message);
    }
  }

  function onUpload(file: File) {
    void file.text().then((text) => {
      setFileText(text);
      setTone(undefined);
      setMessage('Loaded ' + file.name + '. Press Parse and check.');
    });
  }

  return (
    <Section feature={feature}>
      <Callout>
        The pepper service’s HMAC key lives only in AWS KMS and has no backup. An exported pepper is the one
        protection a user can hold against its loss. Passphrase protection of the file is <strong>not implemented
        in the SDK yet</strong>. Pepper 0 is refused on mainnet; <code>NO_PEPPER</code> is for testnets only.
      </Callout>
      <div className="grid two" style={{ marginTop: 16 }}>
        <Card title="Export">
          <p>
            Sample claims: <code>{claims.iss}</code>, aud <code>{claims.aud}</code>, sub <code>{claims.sub}</code>.
            A fresh random pepper is used each time.
          </p>
          <div className="actions">
            <Button variant="primary" onClick={exportFile}>
              Export pepper file
            </Button>
            <Button onClick={download} disabled={!fileText}>
              Download JSON
            </Button>
          </div>
        </Card>
        <Card title="Parse and check">
          <Field label="sub used to check the file (try changing it)">
            <input value={sub} onChange={(e) => setSub(e.target.value)} />
          </Field>
          <Field label="File contents">
            <textarea value={fileText} onChange={(e) => setFileText(e.target.value)} spellCheck={false} />
          </Field>
          <div className="actions">
            <Button variant="primary" onClick={parse} disabled={!fileText}>
              Parse and check
            </Button>
            <label className="btn">
              Upload
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                }}
              />
            </label>
          </div>
        </Card>
      </div>
      <Output tone={tone}>{message}</Output>
    </Section>
  );
}
