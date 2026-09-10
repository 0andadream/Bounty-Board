# Bounty Board

[![Live](https://img.shields.io/badge/live-bounty--board.mattt--dreamer.workers.dev-d8ff3e)](https://bounty-board.mattt-dreamer.workers.dev/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![NIM](https://img.shields.io/badge/pay-NIM%20%2B%20USDT-111111)](https://nimiq.dev/mini-apps)
[![Competition](https://img.shields.io/badge/Nimiq-Mini%20Apps%20Cycle%20II-7828E8)](https://miniappscompetition.com/)

**Live product: [bounty-board.mattt-dreamer.workers.dev](https://bounty-board.mattt-dreamer.workers.dev/)** — a two-sided bounty board inside [Nimiq Pay](https://nimiq.dev/mini-apps/).

Someone needs a task done. Someone else wants to earn. You post a spec with a **NIM** reward (USDT on Polygon is optional). A hunter submits proof. You pay them **wallet to wallet**. Board never holds the money. The receipt is the transaction hash.

This is **not** an escrow board and **not** a chat thread. Nimiq Pay already holds the keys. Board holds the ticket: who posted, who submitted, what was promised, and the hash that proves they got paid.

```
post a bounty → submit proof → pay in NIM → keep the receipt
```

Open in Nimiq Pay:

```
nimiqpay://miniapp?url=bounty-board.mattt-dreamer.workers.dev
https://nimpay.app/miniapps/open/bounty-board.mattt-dreamer.workers.dev
```

---

## What it actually does

1. **Open the Mini App.** On the web, `/` is the landing page. Inside Nimiq Pay, `/` redirects to `/bounties`. The wallet connects with `listAccounts()` (native confirmation). On desktop, Connect opens [Nimiq Hub](https://nimiq.github.io/hub/).
2. **Post a bounty** (`/bounties?create=1`). Title, spec, proof type (text / URL / image), duration, **1–10 winners**, reward in NIM (default) or USDT. Each winner is paid that reward from your wallet. No escrow.
3. **Find a bounty.** Open tickets live on `/bounties`. Highest-reward rail, Open / Submissions / Paid tabs.
4. **Submit work.** First-come slots. Proof is a note, links, and up to **4 photos**. Claim + submit is one action in the UI.
5. **Pay hunter in NIM.** Poster-only. Nimiq Pay / Hub confirms. NIM sends with memo `BOUNTY:<id>:PAID` via `sendBasicTransactionWithData`. USDT uses Polygon `eth_sendTransaction`. **No hash, not paid.**
6. **Receipt** at `/b/:id/receipt`. Poster, hunter(s), amount, asset, timestamp, explorer link. Meant to be screenshotted.

If the wallet rejects, the network fails, or no hash comes back, the bounty stays submitted. Retry is available. Expired tickets are not auto-reverted. The poster reposts.

---

## Current routes

Verified against `src/App.tsx`.

| URL | Code | Purpose |
|---|---|---|
| [`/`](https://bounty-board.mattt-dreamer.workers.dev/) | `src/screens/Landing.tsx` | Landing (web). Mini App redirects to `/bounties`. |
| [`/bounties`](https://bounty-board.mattt-dreamer.workers.dev/bounties) | `src/screens/Board.tsx` | The board. Feed, create modal, rail. |
| [`/bounties?create=1`](https://bounty-board.mattt-dreamer.workers.dev/bounties?create=1) | `PostBountyModal` | Create bounty. |
| [`/b/:id`](https://bounty-board.mattt-dreamer.workers.dev/bounties) | `src/screens/BountyDetail.tsx` | Brief, submissions feed, pay. |
| [`/b/:id/receipt`](https://bounty-board.mattt-dreamer.workers.dev/) | `src/screens/Receipt.tsx` | Paid receipt. |
| [`/mine`](https://bounty-board.mattt-dreamer.workers.dev/mine) | `src/screens/MyWork.tsx` | My bounties / my submissions. |
| [`/profile`](https://bounty-board.mattt-dreamer.workers.dev/profile) | `src/screens/Profile.tsx` | Wallet profile (username, photo). |
| [`/u/:username`](https://bounty-board.mattt-dreamer.workers.dev/) | `src/screens/PublicProfile.tsx` | Public profile + poster trust. |
| [`/probe`](https://bounty-board.mattt-dreamer.workers.dev/probe) | `src/screens/Probe.tsx` | Official 3-request Pay provider check. |
| `/board` | redirect | → `/bounties` |
| `/new` | redirect | → `/bounties?create=1` |

---

## Why no escrow

Most bounty products either custody funds or live in DMs with no proof of payment. Board does neither.

Trust without a vault, on every bounty and profile:

- bounties posted
- paid / completed
- unpaid after submit
- settled NIM and USDT
- likes

Pay-on-approve is the entire payment surface. The substitute for escrow is the **receipt**.

---

## Nimiq Pay integration

`src/providers/nimiq.ts` is the **only** file that imports `@nimiq/mini-app-sdk`.

Used:

- `init()`
- `listAccounts()`
- `isConsensusEstablished()`
- `getBlockNumber()`
- `sendBasicTransactionWithData({ recipient, value, data, validityStartHeight? })`

`value` is integer luna (`1 NIM = 100_000 luna`). The official method takes an **object**, not positional arguments.

Not used, because they are not on the Mini App provider:

- `getTransactionsByAddress()` — payment proof is the hash returned by `sendBasicTransactionWithData`.

Desktop uses Hub (`chooseAddress` + `checkout`) when `window.nimiq` is missing. USDT uses EIP-1193 `window.ethereum` on Polygon (`0xc2132D05D31c914a87C6611C10748AEb04B58e8F`). ERC-20 transfers cannot carry `BOUNTY:<id>:PAID`; the receipt still stores the Polygon hash.

---

## Architecture

```
Nimiq Pay WebView  (or desktop + Hub)
  └── Vite + React + TypeScript
        ├── src/providers/nimiq.ts   → Mini App SDK only
        ├── src/providers/hub.ts     → desktop connect / pay
        ├── src/providers/usdt.ts    → Polygon USDT
        ├── shared/machine.ts        → open → claimed → submitted → paid
        └── Cloudflare Worker + D1
              └── shared board (not localStorage)
```

| Object | Role |
|---|---|
| `shared/machine.ts` | Claim / submit / pay rules. No I/O. |
| `shared/trust.ts` | Poster paid/completed/settled counts. |
| `worker/index.ts` | Hono API, D1, seed flag. |
| `src/providers/pay.ts` | NIM send + Hub fallback. |
| `src/screens/Receipt.tsx` | Shareable paid ticket. |

State lives on D1 so two phones see the same board. Profiles are keyed to the wallet (`likeWalletKey`), cached locally so a username survives leaving the Mini App.

---

## State machine

Stored: `open → claimed → submitted → paid`.

`expired` is a **view** when `now > deadline` and not all winners are paid. The row is not mutated back to open.

**Submit work** is one UI action: it takes a first-come slot, then writes proof. `claimed` is the hold if proof write fails after claim.

You set **1–10 winners**. Reward is **per winner**. Poster pays each accepted hunter separately. The bounty stays open until those slots are filled or paid.

Rules in `shared/machine.ts`:

- Slots are first-come. Poster cannot take their own.
- Only the poster marks paid, and only after proof **and** a real tx hash.
- Pay is not recorded if the wallet rejects or returns no hash.

```bash
npm test          # shared/machine.test.ts + shared/trust.test.ts
```

---

## Local development

Node 18+.

```bash
git clone https://github.com/0andadream/Bounty-Board.git && cd Bounty-Board
npm install
cp .env.example .env
npm run dev
```

This starts:

- Vite at `http://localhost:5174` (also on your LAN IP)
- Worker + local D1 at `http://127.0.0.1:8788`

Vite proxies `/api` to the Worker.

```bash
npm test
npm run build
npm run deploy          # build + wrangler deploy
```

### Load inside Nimiq Pay

Follow [Load a local Mini App](https://nimiq.dev/mini-apps/development/load-local-mini-app):

1. Phone and computer on the same Wi-Fi.
2. `npm run dev` — Network URL, e.g. `http://192.168.1.42:5174`.
3. Nimiq Pay → Mini Apps → Custom URL → that address.
4. Open `/probe`. Tap **Run 3 requests**. `listAccounts()` must return a real address before anything else matters.

Testnet NIM: in Nimiq Pay, long-press Settings for 10 seconds, switch to Testnet, **Get free NIM**.

### Environment

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Worker origin. Empty in local dev (Vite proxy). |
| `VITE_APP_URL` | Public origin for receipts and share links. |
| `SEED_BOUNTIES` | Worker var. `false` in production. `true` inserts 5 demo NIM bounties when D1 is empty. |

No API secrets. The Worker does not hold keys.

Remote D1 is already bound in `wrangler.toml` for this account. Schema is applied on first API request (`ensureSchema`).

```bash
npx wrangler login
npm run db:migrate:remote
npm run deploy
```

Cloudflare Git deploy: set **Build command** to `npm run build` so `./dist` exists for `[assets]`.

---

## Honesty

- **No escrow.** If the poster never pays, Board cannot move funds.
- **No hash, not paid.** A rejected wallet leaves the bounty submitted.
- **NIM memo is the on-chain receipt.** USDT on Polygon cannot carry that memo.
- **Proof is a note, links, and photos.** Videos and PDFs go behind a URL.
- **Seed is off** on production. The board is whatever people post.
- Desktop Hub and Nimiq Pay are different surfaces. Same board, different connect path.

---

## Attribution

**Wallets and NIM pay** — [Nimiq Pay Mini Apps](https://nimiq.dev/mini-apps), [Nimiq Hub](https://nimiq.github.io/hub/).

**USDT** — Polygon USDT via `window.ethereum`.

**App** — Vite, React, TypeScript, Tailwind, Cloudflare Worker + D1, Hono.

Built for the [Nimiq Mini Apps Competition](https://miniappscompetition.com/), Cycle II.

---

## License

MIT. See [LICENSE](./LICENSE).
