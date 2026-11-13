# Kamui demo

An interactive dapp that demonstrates every user-facing feature of
[Kamui](https://github.com/starknet-innovation/kamui), the Starknet embedded wallet: social
login, a pepper recovery file, deterministic accounts, the keychain protocol, SNIP-41 sessions
and spending policies, sponsored and self-paid calls, owners, the session registry, revocation,
the account reader, SNIP-9 outside execution, client-side proving, and the security model.

Each section has a short explanation and a playground that runs the **real Kamui SDK** in the
browser. Two sections also read Starknet Sepolia (token metadata and `KamuiReader`).

**Connect with Kamui (Google)** in the header sends you to the hosted keychain at
`https://sepolia.kamui.page` (`beginConnect` / `finishConnect`). Google sign-in, pepper and
recovery happen on that site; this demo receives a scoped session key and shows the connected
account. An in-app **demo keychain** is available as a fallback toggle (real protocol checks,
simulated approval, no on-chain session).

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
RPC. `VITE_KEYCHAIN_URL` and `VITE_API_URL` default to `https://sepolia.kamui.page`. Set either
to empty, or use the header toggle, to fall back to the in-app demo keychain.

The pepper service at `https://pepper-sepolia.kamui.page` is live and origin-allowlisted.
Direct calls from *this demo’s* origin are refused (`ORIGIN_NOT_ALLOWED`); the hosted
keychain’s origin is already allowed, which is why Connect does not need this demo to be
pepper-allowlisted. `https://api-sepolia.kamui.page` was not reachable (TLS) when this was
written; the keychain talks to its own `/api` instead.

The SDK is vendored from `starknet-innovation/kamui` at commit
`a6e491c2a115ce5489ffbd6a45d93f3c1840afea` under `vendor/kamui-sdk/` (MIT). Import is
source-only, matching the upstream package.

## Feature map

| Feature | Where it is demonstrated | What the playground does |
|---|---|---|
| What Kamui is | [Overview](#overview) | Product framing, current Sepolia/Google scope, why this is not Argent or Braavos |
| Social login | [Social login](#social-login) | Explainer of what the hosted keychain does after Connect: Google sign-in, pepper and recovery stay on `sepolia.kamui.page`. This demo never receives a Google token |
| Pepper recovery file | [Pepper file](#pepper) | `exportPepper`, `serializePepperFile`, `parsePepperFile`, `pepperFileMatchesLogin`, `pepperFromFile` |
| Deterministic address | [Account address](#address) | `identity`, `accountAddress`, `accountAddressFromLogin`, `constructorCalldata`, `NO_PEPPER` |
| Keychain connect | [Keychain connect](#keychain) | `beginConnect` / `finishConnect` against `https://sepolia.kamui.page` by default; in-app demo keychain as a fallback toggle |
| Session scopes | [Session scopes](#sessions) | Scope builder run through `assertValidSession` and `sessionProblems`; blocked entry points |
| Spending policies | [Spending policies](#spending) | `unlimitedTokenCalls` and SNIP-41 Part H limits |
| Sponsored session calls | [Sponsored calls](#sponsored) | `sessionCall` + `sponsor` against the Sepolia Target `ping()`. Labeled, not live, on this static site: sending needs a server that injects a private sponsor token (see `apps/demo-dapp/server.ts`) |
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
| Pepper fetch, deploy and recover *from this origin* | These run on the hosted keychain when you Connect, not in this demo. Direct calls from this origin to `https://pepper-sepolia.kamui.page` are still refused (`ORIGIN_NOT_ALLOWED`); `https://api-sepolia.kamui.page` still failed a TLS handshake when last checked. Neither blocks Connect. |
| Sponsored `ping()` (session registration itself is live via Connect) | After Connect, the session is registered on chain by the keychain. Sending a sponsored call still needs a **server-side** `SPONSOR_SERVER_TOKEN`, injected the way kamui’s `apps/demo-dapp/server.ts` does on `/api/sponsor`. A static GitHub Pages site cannot hold that token, and `https://sepolia.kamui.page/sponsor` is not a public gateway (404). Set `VITE_SPONSOR_URL` to your own proxy to enable the send. One-off execute still works: the keychain submits that transaction itself. |
| Self-paid session transactions | Needs a session with `maxFeePerTx > 0` registered on chain and an account funded with test STRK. |
| Client-side SNIP-36 proving in this page | The Wasm runtime lives in the Kamui keychain (large assets, desktop Chromium memory64, tens of seconds). First-deployment and hosted-origin acceptance are still pending upstream. |
| Apple sign-in | Implemented in the SDK, deferred in the current Google-only rollout. |
| Override recovery | In the contracts (7-day delay); the SDK does not yet expose the calls, and it has not been exercised with a pepper. |
| AVNU paymaster | Optional backend transport, Sepolia-only, not tested live. |
| Wallet-standard connector, iframe/popup modes | Not built. Apps use the redirect helpers. |
| Pepper-file passphrase protection | Not implemented in the SDK. |
| Argent / Braavos wallet connect | Not a Kamui feature. Kamui is its own embedded wallet; apps redirect to the Kamui keychain. |

## Deployment

The GitHub Actions workflows are in [`.github/workflows/`](.github/workflows/). Pages is
enabled with **Source** set to **GitHub Actions**, and deploys from `main`.

This repository is **public**. GitHub Pages serves the site at
[https://starknet-innovation.github.io/kamui-demo/](https://starknet-innovation.github.io/kamui-demo/).

The Vite `base` path is taken from `VITE_BASE_PATH` if that is set, otherwise from
`GITHUB_PAGES=1` (which the current Pages workflow already sets) as `/kamui-demo/`,
and otherwise `/` for local dev and CI. The keychain `redirectUri` is this site’s base
(`https://starknet-innovation.github.io/kamui-demo/` on Pages, `http://localhost:5175/` locally).
The answer comes back in the URL fragment (`#kamui=…`); `finishConnect` runs on load. The SPA
`404.html` fallback uses Vite’s `import.meta.env.BASE_URL`.

Optionally, the Pages workflow can pass `actions/configure-pages`’s `base_path`
into the build instead of relying on `GITHUB_PAGES=1`:

```yaml
- id: pages
  uses: actions/configure-pages@v5
- run: bun run build
  env:
    VITE_BASE_PATH: ${{ steps.pages.outputs.base_path }}
```

That is not required for the public project-site URL: `GITHUB_PAGES=1 bun run build`
already produces the `/kamui-demo/` base.

No secrets are required for the static deploy. The hosted keychain is the default. Sponsored
transactions need a server you control (never bake relayer keys, sponsor tokens, or KMS
credentials into this frontend). The reference is kamui’s `apps/demo-dapp/server.ts`, which
proxies `/api/sponsor` and sets `x-kamui-sponsor-token`.

## Stack

Vite 6, React 18, TypeScript, starknet.js 10.8.0, the vendored `@kamui/sdk`. Tests are Vitest
(no network) plus an optional Playwright screenshot pass (`bun run screenshots`).
