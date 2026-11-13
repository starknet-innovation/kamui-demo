import { FEATURES } from '../lib/features';
import { DEFAULT_KEYCHAIN_URL } from '../lib/config';
import { Callout, Card, Section, Steps } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'social-login')!;

const steps = [
  {
    title: 'You click Connect with Kamui (Google)',
    body: 'This demo only runs beginConnect. It creates a session key, stores it in this tab’s sessionStorage, and sends you to the hosted keychain’s /connect with the request in the URL fragment.',
  },
  {
    title: 'Google sign-in on the keychain',
    body: 'The keychain at sepolia.kamui.page runs beginLogin, sends you to Google, and comes back to its own /callback. The device private key never leaves the keychain’s origin. This demo never receives a Google token.',
  },
  {
    title: 'Pepper and recovery, still on the keychain',
    body: 'The keychain proves possession of the device key to the pepper service (its own origin is already allowlisted) and, when this is a new device, runs deploy and recover through its own /api. A login on a new device revokes every existing session; the keychain warns before that.',
  },
  {
    title: 'finishConnect back here',
    body: 'The keychain registers the session on the account (an owner-signed sponsored call) and redirects to this app with the account address in the fragment. From then on this demo signs session calls itself. The session private key never left this app; the device key never left the keychain.',
  },
];

export function SocialLogin() {
  return (
    <Section feature={feature}>
      <Card title="What happens inside the keychain">
        <p>
          Google sign-in is not something this demo runs itself. The prominent{' '}
          <strong>Connect with Kamui (Google)</strong> button in the header sends you to{' '}
          <code>{DEFAULT_KEYCHAIN_URL}</code>, which already implements login, pepper and recovery.
          The steps below are what that site does before it hands this app a scoped session.
        </p>
      </Card>
      <Callout tone="info">
        A login on a new device revokes every session on the account. The keychain warns the user
        before that. Apple sign-in is retained in the SDK but hidden in the current Google-only rollout.
      </Callout>
      <Steps items={steps} />
    </Section>
  );
}
