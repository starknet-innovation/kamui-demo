/** One entry per user-facing Kamui feature this dapp demonstrates. */
export type Badge = 'sdk' | 'live' | 'sim' | 'off';

export type Feature = {
  id: string;
  title: string;
  nav: string;
  blurb: string;
  badges: Badge[];
};

export const FEATURES: Feature[] = [
  {
    id: 'overview',
    title: 'What Kamui is',
    nav: 'Overview',
    blurb: 'A Controller-style embedded wallet for Starknet: social login, session keys, sponsored transactions, and one keychain shared by every app.',
    badges: ['sdk'],
  },
  {
    id: 'social-login',
    title: 'Social login',
    nav: 'Social login',
    blurb: 'Real Google sign-in via beginLogin, authUrl and a /callback that runs parseLoginRedirect and keyProof. Pepper and completeLogin follow when those services allow this origin.',
    badges: ['sdk'],
  },
  {
    id: 'pepper',
    title: 'Pepper recovery file',
    nav: 'Pepper file',
    blurb: 'Export, parse and check a recovery file. The pepper service key has no backup; this file is the user’s protection against its loss.',
    badges: ['sdk'],
  },
  {
    id: 'address',
    title: 'Deterministic account address',
    nav: 'Account address',
    blurb: 'identity = poseidon(iss, aud, sub, pepper); the address is a UDC deployment from zero with that identity as salt. It depends on the class hash.',
    badges: ['sdk'],
  },
  {
    id: 'keychain',
    title: 'Keychain connect',
    nav: 'Keychain connect',
    blurb: 'The app creates a session key and redirects to the keychain. The user approves a scoped session; the private session key never leaves the app.',
    badges: ['sdk', 'sim'],
  },
  {
    id: 'sessions',
    title: 'Session scopes',
    nav: 'Session scopes',
    blurb: 'SNIP-41 sessions with contract-and-entrypoint scopes, expiry, maxCalls and maxFeePerTx. The SDK refuses scopes the contract would never honour.',
    badges: ['sdk'],
  },
  {
    id: 'spending',
    title: 'Spending policies',
    nav: 'Spending policies',
    blurb: 'Per-token limits (max per call, max per window). Under SNIP-41 a token with no policy is unrestricted — the SDK therefore refuses unlimited token calls.',
    badges: ['sdk'],
  },
  {
    id: 'sponsored',
    title: 'Sponsored session calls',
    nav: 'Sponsored calls',
    blurb: 'After connect, the app signs with its session key and posts execute_from_outside_v2 to the sponsor gateway. The relayer pays; the keychain is not involved again.',
    badges: ['sdk', 'sim'],
  },
  {
    id: 'out-of-scope',
    title: 'Out-of-scope refusal',
    nav: 'Out-of-scope',
    blurb: 'A session that may only call ping() is refused by the account if it tries transfer(). The keychain also refuses such a session at approval time if it asked for a blocked function.',
    badges: ['sdk'],
  },
  {
    id: 'execute',
    title: 'One-off execute',
    nav: 'One-off execute',
    blurb: 'For anything the session does not cover, the app sends the user to /execute. The keychain shows every call in plain words and sends it once with the account’s full authority.',
    badges: ['sdk', 'sim'],
  },
  {
    id: 'tokens',
    title: 'Token amounts',
    nav: 'Token amounts',
    blurb: 'Approval screens name amounts exactly: “1.5 STRK”. Known, unverified and unknown tokens are told apart, and conventional unlimited allowances are called unlimited.',
    badges: ['sdk', 'live'],
  },
  {
    id: 'self-paid',
    title: 'Self-paid sessions',
    nav: 'Self-paid sessions',
    blurb: 'A session with maxFeePerTx above zero can pay its own fees via createSessionAccount. Fee estimation must run with validation on.',
    badges: ['sdk'],
  },
  {
    id: 'owners',
    title: 'Owner keys',
    nav: 'Owners',
    blurb: 'Up to five device keys. Any owner signs. Adding or removing a key — including a login on a new device — revokes every session. A full set refuses a manual add; recovery replaces the oldest.',
    badges: ['sdk'],
  },
  {
    id: 'registry',
    title: 'Session registry',
    nav: 'Session registry',
    blurb: 'An untrusted server-side list so the keychain can show sessions. What a record claims is only a claim; the account is the authority. Clock skew is trusted to five minutes.',
    badges: ['sdk'],
  },
  {
    id: 'revocation',
    title: 'Session revocation',
    nav: 'Revocation',
    blurb: 'Revoke one session or all of them. The session epoch increases on revoke-all and on every owner change. Apps must check reader.session(key).exists before signing again.',
    badges: ['sdk'],
  },
  {
    id: 'reader',
    title: 'Account reader',
    nav: 'Account reader',
    blurb: 'KamuiReader: owners, anchor, session epoch, session data and scope, spending policies, nonces, and whether the account is deployed — against Starknet Sepolia.',
    badges: ['sdk', 'live'],
  },
  {
    id: 'outside',
    title: 'Outside execution',
    nav: 'Outside execution',
    blurb: 'SNIP-9 v2: ownerOutsideExecution and sessionOutsideExecution. Sponsored session nonces are a reserved range of maxCalls values, counted separately from the self-paid path.',
    badges: ['sdk'],
  },
  {
    id: 'proving',
    title: 'Client-side proving',
    nav: 'Client proving',
    blurb: 'A new device proves the login token in the browser (SNIP-36 Wasm). Existing-account recovery sends no JWT to the API. A device that already owns the account costs two reads and no proof.',
    badges: ['sdk'],
  },
  {
    id: 'security',
    title: 'Security model',
    nav: 'Security',
    blurb: 'Redirects, origin checks, a non-exportable vault, a strict CSP, and the things Kamui will not do at a site’s request. Not audited; Sepolia only; accounts are not upgradeable.',
    badges: ['sdk'],
  },
];
