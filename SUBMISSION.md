# Board — Mini Apps Competition

Board is a bounty board inside Nimiq Pay. You post a spec and a NIM reward. One hunter submits proof. You pay them from your own wallet. There is no escrow and no committee. The receipt is the product: bounty id, both wallets, amount, asset, time, and the transaction hash.

It is for people who hire in DMs — designers, editors, researchers — then argue about whether they got paid. Board turns that handshake into a ticket you can screenshot. NIM is the default path. Payments use `listAccounts()`, check consensus and block height, then `sendBasicTransactionWithData` with memo `BOUNTY:<id>:PAID`. USDT on Polygon is optional. Keys never leave the wallet. Board never marks paid without a tx hash.

Trust without a vault: every bounty and profile shows how often that poster paid completed work, total settled in NIM and USDT, and unpaid-after-submit. After pay, `/b/:id/receipt` is shareable.

Two phones see the same board because state lives on Cloudflare D1, not localStorage. Submit is first-come. Open it in Nimiq Pay (`nimiqpay://miniapp?url=bounty-board.mattt-dreamer.workers.dev`). The wallet connects on launch, the board is the first screen, live NIM bounties are already up. Claim one, submit proof, pay, keep the receipt.
