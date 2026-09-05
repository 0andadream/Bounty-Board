# Board

**Post a task. Pay wallet to wallet. Keep the receipt.**

Board is a bounty board that runs as a [Nimiq Pay Mini App](https://nimiq.dev/mini-apps/). Someone posts a task and a reward in **NIM** or **USDT on Polygon**. One hunter claims it, submits a proof link, and the poster pays them directly from their wallet. There is no escrow, no dispute court, and no bidding.

The receipt — poster, hunter, task, amount, tx hash — is the product. It is meant to be screenshotted and shared.

Built for the [Nimiq Mini Apps Competition](https://miniappscompetition.com/).

## Why it exists

Most bounty boards either custody funds or live in a chat thread with no proof of payment. Board does neither. Nimiq Pay already holds the keys. Board holds the ticket: who posted, who claimed, what was promised, and the hash that proves the poster paid.

## Core user flow

1. Open Board inside Nimiq Pay.
2. Wallet connects via `listAccounts()` (native confirmation).
3. Poster writes a title, brief, reward, token, and deadline.
4. Hunter claims. The write is atomic — two taps cannot both win.
5. Hunter submits an `https` proof link.
6. Poster taps **Pay**. Nimiq Pay shows the native confirmation.
7. NIM payments attach memo `BOUNTY:<id>:PAID`. USDT payments go to Polygon USDT.
8. Board records paid **only** after the wallet returns a transaction hash.
9. Receipt screen: paid stamp, both wallets, hash, timestamp, share.

If the wallet rejects, the network fails, or no hash comes back, the bounty stays submitted. Retry is available.

Expired tickets are not auto-reverted. The poster reposts.

## Architecture

```
Nimiq Pay WebView
  └── Board (Vite + React + TypeScript)
        ├── src/providers/nimiq.ts   → ONLY file that imports @nimiq/mini-app-sdk
        ├── src/providers/usdt.ts    → window.ethereum, USDT on Polygon
        ├── shared/machine.ts        → open → claimed → submitted → paid (+ expired view)
        └── Cloudflare Worker + D1
              └── shared bounties (not localStorage)
```

- **Frontend:** Vite, React, TypeScript, Tailwind. Mobile-first, 430px frame on desktop.
- **Backend:** Cloudflare Worker (Hono) + D1. Canonical shared state so a poster on one phone and a hunter on another see the same ticket.
- **No custody:** the Worker stores wallet addresses, task text, reward, deadline, status, proof URL, and tx hash. No emails, no uploaded files, no private keys.

### Confirmed NIM API (from `@nimiq/mini-app-sdk` + official provider reference)

Used:

- `init()`
- `listAccounts()`
- `isConsensusEstablished()`
- `getBlockNumber()`
- `sendBasicTransactionWithData({ recipient, value, data, validityStartHeight? })`

`value` is integer luna (`1 NIM = 100_000 luna`). The official method takes an **object**, not positional arguments.

Not used, because they are not on the Mini App provider:

- `getTransactionsByAddress()` — not exposed. Payment proof is the hash returned by `sendBasicTransactionWithData`.

Staking methods exist on the provider. Board does not call them.

USDT uses standard EIP-1193 `window.ethereum` calls (`eth_requestAccounts`, `wallet_switchEthereumChain`, `eth_call`, `eth_sendTransaction`) against Polygon USDT `0xc2132D05D31c914a87C6611C10748AEb04B58e8F`. ERC-20 transfers cannot carry a text memo; the receipt still stores the Polygon tx hash.

## Screens

| Route | Screen |
|---|---|
| `/` | Board — open / claimed / paid tabs |
| `/new` | New bounty |
| `/b/:id` | Bounty detail — timeline, claim, proof, Pay (gated on poster wallet) |
| `/mine` | My work — posted + claimed |
| `/b/:id/receipt` | Receipt — paid stamp, perforation, share |
| `/probe` | Official 3-request provider check |

## Local development

Requirements: Node.js 18+.

```bash
cd Board
npm install
cp .env.example .env
npm run dev
```

This starts:

- Vite at `http://localhost:5173` (also on your LAN IP)
- Cloudflare Worker + local D1 at `http://127.0.0.1:8787`

Vite proxies `/api` to the Worker.

```bash
npm test          # pure state-machine tests
npm run build
```

### Load inside Nimiq Pay

Follow [Load a local Mini App](https://nimiq.dev/mini-apps/development/load-local-mini-app):

1. Phone and computer on the same Wi-Fi.
2. `npm run dev` — note the **Network** URL, e.g. `http://192.168.1.42:5173`.
3. Nimiq Pay → Mini Apps → Custom URL → that address.
4. Open `/probe` first. Tap **Run 3 requests**. `listAccounts()` must return a real address before anything else matters.

`listAccounts()` will not return accounts in a normal desktop browser. That is expected. The provider is injected by Nimiq Pay.

For testnet NIM without spending mainnet funds: in Nimiq Pay, long-press Settings for 10 seconds and switch to Testnet. The empty-state home screen has **Get free NIM**.

## Environment variables

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Worker origin. Leave empty in local dev (Vite proxy). Set in production if the UI is hosted separately. |
| `VITE_APP_URL` | Public Mini App origin used on receipts and share links. |

The Worker does not need API secrets.

## Backend setup

Local D1 is created by `wrangler dev`. Schema is applied on first API request.

Remote:

```bash
npx wrangler login
npx wrangler d1 create board
```

Put the database id in `wrangler.toml`, then:

```bash
npm run db:migrate:remote
npx wrangler deploy
```

Host the Vite `dist/` build on Cloudflare Pages, Workers static assets, or any HTTPS host. Point `VITE_API_URL` at the Worker if they are on different origins.

Share the Mini App with:

```
nimiqpay://miniapp?url=your-app.com
https://nimpay.app/miniapps/open/your-app.com
```

## State machine

Stored statuses: `open → claimed → submitted → paid`.

`expired` is a **view** status when `now > deadline` and the bounty is not paid. The row is not mutated back to open. The poster posts a new ticket.

Rules in `shared/machine.ts` (no I/O):

- One hunter. Claim is an atomic SQL `UPDATE … WHERE status = 'open' AND hunter IS NULL`.
- Only the hunter who claimed can submit a proof URL.
- Only the poster can mark paid, and only after proof + a real tx hash.
- Pay is not recorded if the wallet rejects or returns no hash.

## Known limitations

- No escrow. Pay-on-approve is the entire Mini App payment surface.
- USDT transfers cannot attach `BOUNTY:<id>:PAID`. NIM transfers can.
- Proof is a URL, not a file upload.
- Desktop browser can read the board but cannot `listAccounts()` unless Nimiq Pay injects the provider.

## License

MIT
