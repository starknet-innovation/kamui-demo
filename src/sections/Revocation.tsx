import { revokeAllSessionsCall, revokeSessionCall } from '@kamui/sdk';
import { FEATURES } from '../lib/features';
import { Callout, Card, Section } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'revocation')!;

const account = '0xabc';
const sessionKey = '0xdef';
const one = revokeSessionCall(account, sessionKey);
const all = revokeAllSessionsCall(account);

export function Revocation() {
  return (
    <Section feature={feature}>
      <Callout tone="warn">
        <strong>Any change of owners revokes every session</strong>, including a login on a new device. Apps
        must check <code>reader.session(key).exists</code> and ask the user to approve again.
      </Callout>
      <div className="grid two">
        <Card title="revoke_session_key">
          <p>
            Built by <code>revokeSessionCall</code>:
          </p>
          <pre className="output">
            {one.entrypoint} @ {one.contractAddress}
            {'\n'}calldata: {(one.calldata as string[]).join(', ')}
          </pre>
          <p>Removes one session. Other sessions on the account keep going. The epoch does not change.</p>
        </Card>
        <Card title="revoke_all_sessions">
          <p>
            Built by <code>revokeAllSessionsCall</code>:
          </p>
          <pre className="output">
            {all.entrypoint} @ {all.contractAddress}
            {'\n'}calldata: {((all.calldata as string[]) ?? []).join(', ') || '(none)'}
          </pre>
          <p>
            The session epoch increases. Every session dies. The same happens on any owner change, which is why
            a new-device login is so disruptive — and why the keychain warns before it.
          </p>
        </Card>
      </div>
    </Section>
  );
}
