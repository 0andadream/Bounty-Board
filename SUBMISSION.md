# Board — Mini Apps Competition

Board is a bounty board inside Nimiq Pay. You post a task and a reward in NIM or USDT. One person claims it, sends a proof link, and you pay them from your own wallet. No escrow. No dispute chat. The receipt is the whole point.

People already hire each other in DMs and then argue about whether they got paid. Board turns that handshake into a ticket you can screenshot: poster wallet, hunter wallet, amount, timestamp, transaction hash. For NIM, the chain itself carries `BOUNTY:<id>:PAID` in the payment memo. For USDT, the Polygon hash is the receipt.

It uses Nimiq Pay the way the framework is meant to be used. Accounts come from `listAccounts()`. Consensus and block height are checked before sending. NIM moves with `sendBasicTransactionWithData`. USDT moves through `window.ethereum` on Polygon. Keys never leave the wallet. Board never marks a bounty paid unless the wallet actually returns a hash.

Two phones see the same board because state lives on a Cloudflare Worker, not in localStorage. Claim is a single atomic write, so two hunters cannot both win. If a deadline passes, the ticket shows expired and the poster reposts — nothing auto-reverts.

The UI is a paper ticket, not a crypto dashboard. Amounts and addresses are mono. Status is a rubber stamp. The paid screen has perforation lines so it looks like something you tear off and keep.

Open it in Nimiq Pay, hit `/probe` if you want to see `listAccounts()` return a real address, then post 1 NIM and walk the receipt.
