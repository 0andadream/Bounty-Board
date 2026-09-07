# Board — Mini Apps Competition

Board is a bounty board inside Nimiq Pay. You post a task and a reward in NIM or USDT. One hunter submits proof. You pay them from your own wallet. There is no escrow. The receipt is the product: both wallets, amount, time, and the transaction hash.

It is for people who already hire in DMs — designers, editors, researchers — and then argue about whether they got paid. Board turns that handshake into a ticket you can screenshot. NIM payments carry memo `BOUNTY:<id>:PAID`. USDT payments record the Polygon hash.

It uses Nimiq Pay the way the framework is meant to be used. Accounts come from `listAccounts()`. Consensus and block height are checked before sending. NIM moves with `sendBasicTransactionWithData`. USDT moves through `window.ethereum` on Polygon. Keys never leave the wallet. Board never marks a bounty paid unless the wallet returns a hash.

Two phones see the same board because state lives on a Cloudflare Worker, not in localStorage. Submit is first-come. If a deadline passes, the ticket shows expired and the poster reposts — nothing auto-reverts.

Open it in Nimiq Pay. The wallet connects on launch, the board is the first screen, and Create bounty is one tap. Post 1 NIM, submit a proof link, pay, and keep the receipt.
