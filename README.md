# Kamui demo

An interactive dapp that demonstrates every user-facing feature of
[Kamui](https://github.com/starknet-innovation/kamui), the Starknet embedded wallet: social
login, a pepper recovery file, deterministic accounts, the keychain protocol, SNIP-41 sessions
and spending policies, sponsored and self-paid calls, owners, the session registry, revocation,
the account reader, SNIP-9 outside execution, client-side proving, and the security model.

Each section has a short explanation and a playground that runs the **real Kamui SDK** in the
browser. Two sections also read Starknet Sepolia (token metadata and `KamuiReader`). When no
hosted keychain is configured, an in-app **demo keychain** walks through `/connect` and
`/execute` with the real protocol checks; it does not submit a transaction.

This is a Sepolia demo. Kamui is **not audited**. Do not hold real funds.

## Running locally

```sh
bun install          # or npm install
bun run dev          # http://localhost:5175
```

```sh
bun run typecheck
bun run test
bun run build
bun run preview      # http://localhost:4173
```

Optional public environment (see `.env.example`): `VITE_RPC_URL` defaults to a public Sepolia
RPC. Live Google login, a hosted keychain, and sponsored pings need additional `VITE_*` values
pointing at a deployed Kamui stack — those services are not public yet
(`https://sepolia.kamui.page` is the planned origin, not a live URL).

The SDK is vendored from `starknet-innovation/kamui` at commit
`a6e491c2a115ce5489ffbd6a45d93f3c1840afea` under `vendor/kamui-sdk/` (MIT). Import is
source-only, matching the upstream package.

## Feature map

| Feature | Where it is demonstrated | What the playground does |
|---|---|---|
| What Kamui is | [Overview](#overview) | Product framing, current Sepolia/Google scope, why this is not Argent or Braavos |
| Social login | [Social login](#social-login) | `beginLogin`, `loginNonce`, `keyProof`, `authUrl` (Google). Live redirect needs a client id, pepper service and API |
| Pepper recovery file | [Pepper file](#pepper) | `exportPepper`, `serializePepperFile`, `parsePepperFile`, `pepperFileMatchesLogin`, `pepperFromFile` |
| Deterministic address | [Account address](#address) | `identity`, `accountAddress`, `accountAddressFromLogin`, `constructorCalldata`, `NO_PEPPER` |
| Keychain connect | [Keychain connect](#keychain) | `beginConnect` / `finishConnect` against the in-app demo keychain (or `VITE_KEYCHAIN_URL`) |
| Session scopes | [Session scopes](#sessions) | Scope builder run through `assertValidSession` and `sessionProblems`; blocked entry points |
| Spending policies | [Spending policies](#spending) | `unlimitedTokenCalls` and SNIP-41 Part H limits |
| Sponsored session calls | [Sponsored calls](#sponsored) | `sessionCall` + `sponsor` against the Sepolia Target `ping()` contract, when a sponsor URL is set |
| Out-of-scope refusal | [Out-of-scope](#out-of-scope) | A ping-only session vs. an unlimited `transfer`, via `sessionProblems` |
| One-off execute | [One-off execute](#execute) | `describeCall`, `executeProblems`, `beginExecute` (approve 1.5 STRK; a call to the account is refused) |
| Token amounts | [Token amounts](#tokens) | `formatTokenAmount`, `describeAmount`, `isUnlimitedAmount`; live `readTokenInfo` on Sepolia for STRK, ETH and the Target contract |
| Self-paid sessions | [Self-paid sessions](#self-paid) | `createSessionAccount`, `maxFeePerTx`, `skipValidate: false`; no funded account is shipped |
| Owner keys | [Owners](#owners) | Up to 5 slots; `signNewOwner`, `addOwnerCall`, `removeOwnerCall`; recovery replaces the oldest |
| Session registry | [Session registry](#registry) | `registryContentHash`, `registryMessageHash`, `signRegistryRequest`, `parseRegistryList` (untrusted input) |
| Session revocation | [Revocation](#revocation) | `revokeSessionCall`, `revokeAllSessionsCall`, epoch / owner-change behaviour |
| Account reader | [Account reader](#reader) | Live `KamuiReader` on Sepolia: owners, anchor, epoch, identity, SRC-5 interfaces |
| Outside execution | [Outside execution](#outside) | `ownerOutsideExecution`, `sessionOutsideExecution`, `ANY_CALLER`, reserved session nonces |
| Client-side proving | [Client proving](#proving) | `browserRecoverBackend` flow, V2 program constants, `recoveryMessage`; the Wasm prover is not shipped here |
| Security model | [Security](#security) | Origin/referrer checks, vault, CSP, redirects vs iframe, trust assumptions, not-yet-built items |

The in-app demo keychain (path `/keychain/connect` and `/keychain/execute`) is itself a
demonstration of the keychain side: `parseConnectRequest`, `sessionProblems`,
`parseExecuteRequest`, `executeProblems`, `describeCall`, `resultUrl`.

## What this demo cannot do live (and why)

These are real Kamui features, shown as explainers or SDK playgrounds, but they cannot be
exercised end-to-end against Sepolia from this frontend alone:

| Feature | Why |
|---|---|
| Live Google sign-in, pepper fetch, deploy and recover | Needs `VITE_GOOGLE_CLIENT_ID`, a running pepper service (`VITE_PEPPER_URL`) with a KMS key, a recover API (`VITE_API_URL`), and a funded relayer. The planned `https://sepolia.kamui.page` / `https://pepper-sepolia.kamui.page` are not deployed. |
| Live session registration and sponsored `ping()` | Needs the hosted keychain plus a sponsor gateway with a funded policy (`VITE_KEYCHAIN_URL`, `VITE_SPONSOR_URL`). Approved-app sponsorship also needs a **server-side** token, which must never be baked into this static site. |
| Self-paid session transactions | Needs a session with `maxFeePerTx > 0` registered on chain and an account funded with test STRK. |
| Client-side SNIP-36 proving in this page | The Wasm runtime lives in the Kamui keychain (large assets, desktop Chromium memory64, tens of seconds). First-deployment and hosted-origin acceptance are still pending upstream. |
| Apple sign-in | Implemented in the SDK, deferred in the current Google-only rollout. |
| Override recovery | In the contracts (7-day delay); the SDK does not yet expose the calls, and it has not been exercised with a pepper. |
| AVNU paymaster | Optional backend transport, Sepolia-only, not tested live. |
| Wallet-standard connector, iframe/popup modes | Not built. Apps use the redirect helpers. |
| Pepper-file passphrase protection | Not implemented in the SDK. |
| Argent / Braavos wallet connect | Not a Kamui feature. Kamui is its own embedded wallet; apps redirect to the Kamui keychain. |

## Deployment

The GitHub Actions workflows are in [`.github/workflows/`](.github/workflows/).

After this is merged to `main`:

1. In the repository **Settings → Pages**, set **Source** to **GitHub Actions**.
2. The site will be at `https://starknet-innovation.github.io/kamui-demo/`.
3. This repository is currently **internal**, so only members of the `starknet-innovation`
   organisation will see the Pages site unless the repository is made public.

No secrets are required for the static deploy. Enabling live login, a hosted keychain, or
sponsored transactions later means setting the public `VITE_*` values at build time (never
relayer keys, sponsor tokens, or KMS credentials — those belong on the Kamui backend, and an
approved-app sponsor token must be injected by a server you control, not by this static app).

## Stack

Vite 6, React 18, TypeScript, starknet.js 10.8.0, the vendored `@kamui/sdk`. Tests are Vitest
(no network) plus an optional Playwright screenshot pass (`bun run screenshots`).
