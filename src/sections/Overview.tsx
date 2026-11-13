import { FEATURES } from '../lib/features';
import { CLASS_HASH, REGISTRY_ADDRESS, RPC_URL, LIVE_KEYCHAIN, KAMUI_COMMIT } from '../lib/config';
import { Callout, Card, Section } from '../components/ui';

const feature = FEATURES[0]!;

export function Overview() {
  return (
    <Section feature={feature}>
      <p className="sub" style={{ marginBottom: 18 }}>
        Kamui is built from public standards (SNIP-5, 6, 9, 12, 41) and permissive components — OpenZeppelin
        accounts, social-account, a SNIP-41 session design — with no Cartridge code. Current rollout is Google
        only, on Starknet Sepolia. It is <strong>not audited</strong>; do not hold real funds.
      </p>
      <div className="grid two">
        <Card title="What a user does">
          <p>
            They sign in with Google in the Kamui keychain. A device key, kept in the keychain’s origin, becomes
            an owner of a deterministic account. An app then asks the keychain to approve a <em>session</em>:{' '}
            a key the app holds, limited to named contracts and functions, optionally with spending limits. After
            that the app can send sponsored calls without asking again, until the session ends.
          </p>
        </Card>
        <Card title="What this demo is">
          <p>
            After you sign in, the wallet at the top of this page is the product: balances, send, and
            contract calls against Starknet Sepolia. The sections below are a tour of the SDK. Connect uses
            the hosted keychain at <code>https://sepolia.kamui.page</code> by default; a toggle under How it
            works falls back to the in-app demo keychain (simulated approval only).
          </p>
        </Card>
      </div>
      <div className="grid three" style={{ marginTop: 16 }}>
        <Card title="This build">
          <p>
            SDK vendored from <code>kamui@{KAMUI_COMMIT.slice(0, 7)}</code>.
            Class hash <code>{CLASS_HASH.slice(0, 10)}…</code>. Registry{' '}
            <code>{REGISTRY_ADDRESS.slice(0, 10)}…</code>.
          </p>
          <p>RPC: <code>{RPC_URL}</code></p>
        </Card>
        <Card title="Live services">
          <p>Hosted keychain: {LIVE_KEYCHAIN ? 'https://sepolia.kamui.page (default)' : 'not configured — using the in-app demo keychain'}.</p>
          <p>Google sign-in, pepper and recovery run on the keychain, not in this app. Sponsored pings need a server-side sponsor token this static site cannot hold.</p>
        </Card>
        <Card title="Not Argent or Braavos">
          <p>
            Kamui is its own embedded wallet. Apps do not connect Argent or Braavos; they redirect to the Kamui
            keychain. A wallet-standard connector is not built yet.
          </p>
        </Card>
      </div>
      <h3 style={{ margin: '28px 0 12px', fontSize: 16 }}>Feature index</h3>
      <div className="feature-index">
        {FEATURES.slice(1).map((f) => (
          <a key={f.id} href={`#${f.id}`}>
            <strong>{f.title}</strong>
            <span>{f.blurb}</span>
          </a>
        ))}
      </div>
      <Callout tone="warn">
        <strong>Sepolia beta only.</strong> Contracts and SDK are unaudited. Existing accounts cannot be
        upgraded. A new class hash means new addresses.
      </Callout>
    </Section>
  );
}
