import { V2_HEADER, V2_PROGRAM, V2_SEPOLIA_CONFIG, recoveryMessage } from '@kamui/sdk';
import { FEATURES } from '../lib/features';
import { Callout, Card, Section, Steps } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'proving')!;

const message = recoveryMessage('0x1', '0x2', '0x3', '0x4');

export function ClientProving() {
  return (
    <Section feature={feature}>
      <Callout>
        <code>completeLogin</code> still skips recovery when the device already owns the account. For a new
        device, supply <code>browserRecoverBackend</code> with a local <code>ClientProver</code>. The keychain
        uses the pinned <code>snip-36-prover-wasm</code> V2 runtime in Workers, without a server fallback. The
        public API rejects the old server-proving path.
      </Callout>
      <Steps
        items={[
          {
            title: 'Already an owner',
            body: 'Two reads, nothing sent, no proof. Returning to the same device is cheap.',
          },
          {
            title: 'Existing account, new device',
            body: 'The browser proves the token locally and posts completed proof/facts and ownership authorisation to /relay. No JWT and no pepper go to the API. An independent job capability is used to poll /recover/status.',
          },
          {
            title: 'First deployment',
            body: 'The browser authenticates /deploy/authenticated (the token is sent to the API for verification), then relays the proof the same way. Ordinary pepper lookup still sends the token to the pepper service.',
          },
        ]}
      />
      <div className="grid two">
        <Card title="Pinned V2 profile">
          <p>These constants are what the SDK and keychain use for Sepolia proofs:</p>
          <pre className="output">
{`V2_PROGRAM:         ${V2_PROGRAM}
V2_SEPOLIA_CONFIG:  ${V2_SEPOLIA_CONFIG}
V2_HEADER:          ${V2_HEADER.slice(0, 40)}…`}
          </pre>
          <p>
            A sample <code>recoveryMessage</code> (account, identity, new key, anchor):{' '}
            <code>{message}</code>
          </p>
        </Card>
        <Card title="What to expect">
          <p>
            A proof takes tens of seconds and wants a desktop Chromium with memory64. Reloading the page does
            not resume polling. The SDK never automatically resubmits once polling has started. A timeout may
            follow an on-chain success — check ownership before signing in again.
          </p>
          <p>
            This demo does not ship the Wasm prover (~large assets, tens of seconds, dedicated Workers). The
            live path lives in the Kamui keychain. First-deployment and hosted-origin acceptance are still
            pending in Kamui itself; existing-account recovery passed on Sepolia in run 11.
          </p>
        </Card>
      </div>
    </Section>
  );
}
