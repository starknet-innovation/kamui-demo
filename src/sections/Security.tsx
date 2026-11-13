import { FEATURES } from '../lib/features';
import { Callout, Card, Section } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'security')!;

export function Security() {
  return (
    <Section feature={feature}>
      <div className="grid two">
        <Card title="Who is asking">
          <p>
            The keychain shows the origin the answer will go to, and refuses a request that did not come from a
            page on that origin (the browser’s referrer). A link on another site cannot ask in an app’s name
            with its own session key.
          </p>
        </Card>
        <Card title="Why redirects, not an iframe">
          <p>
            Browsers isolate storage inside third-party iframes, so one keychain shared by every app does not
            work in an iframe without extra permissions; a popup can lose its link to the app while it visits
            the issuer. Redirects have neither problem. The cost is that the app’s page reloads. Embedded modes
            are not built yet.
          </p>
        </Card>
        <Card title="Where the device key lives">
          <p>
            In IndexedDB, in the keychain’s origin, encrypted with an AES-GCM key the browser will not export.
            A Stark-curve key cannot itself be a non-exportable browser key, so this is the closest available:
            the stored bytes are useless elsewhere. Code running in the keychain’s origin can still use the key,
            which is why the page is served with a strict CSP (only its own script and style, no framing) and
            loads nothing from third parties.
          </p>
        </Card>
        <Card title="What a site can never ask">
          <p>
            An execute request may not target the account itself. Device keys, sessions and spending limits
            change only from the keychain’s own pages. Sessions cannot call blocked entry points or the account.
            Token calls need a spending policy.
          </p>
        </Card>
        <Card title="Trust assumptions">
          <p>
            The issuer (Google) is trusted to identify the user. The pepper service is trusted to give the same
            pepper every time and not to leak it. The backend is trusted to pay for deployments and recoveries
            within its policy, not to invent proofs. The registry is <em>not</em> trusted. The id_token’s
            signature is checked by the pepper service, the backend and the contract, not by the app.
          </p>
        </Card>
        <Card title="What is not here">
          <p>
            Override recovery (7-day delay, different whitelisted aud) is in the contracts; the SDK does not yet
            expose the calls, and it has not been exercised with a pepper. AVNU paymaster mode is unwired for
            live use. A wallet-standard connector is not built. Fiat, gaming features, EVM owners and a native
            mobile SDK are out of scope for v1. Passphrase protection of the pepper file is not implemented.
            Apple sign-in is deferred.
          </p>
        </Card>
      </div>
      <Callout tone="warn">
        <strong>Not audited. Do not hold real funds.</strong> Kamui accounts are not upgradeable. Current
        rollout is Google only, on Starknet Sepolia. The planned public origin{' '}
        <code>https://sepolia.kamui.page</code> is not deployed.
      </Callout>
    </Section>
  );
}
