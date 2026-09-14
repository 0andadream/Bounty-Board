import { Link } from 'react-router-dom'
import { BackKey } from '../components/BackKey.tsx'
import { PAY_MINIAPP_URL } from '../lib/links.ts'

export function Docs() {
  return (
    <main className="screen docs-page">
      <BackKey />
      <p className="pool-kicker mt-0 mb-2">Docs</p>
      <h1 className="mt-0 mb-3 text-[36px] tracking-[-0.05em]">How Bounty Board works</h1>
      <p className="mt-0 mb-8 text-[16px] text-muted max-w-[640px]">
        Someone needs something done. Someone else wants to earn. You post a task with a NIM reward, or pick one up and
        get paid. Board never holds the money.
      </p>

      <section className="docs-block">
        <h2>Post a bounty</h2>
        <p>
          Open <Link to="/bounties?create=1">Create bounty</Link>. Write the task, set a NIM reward (USDT on Polygon is
          optional), pick a proof type, duration, and how many winners (1–10). Each winner is paid that reward from your
          wallet. There is no escrow.
        </p>
      </section>

      <section className="docs-block">
        <h2>Find a bounty and submit</h2>
        <p>
          Browse <Link to="/bounties">the board</Link>. Open a ticket, do the work, tap Submit work. Send a note, links,
          and up to 4 photos. Slots are first-come. You cannot submit on your own bounty.
        </p>
      </section>

      <section id="pay" className="docs-block">
        <h2>Pay in NIM</h2>
        <p>
          Only the poster pays. Connect the poster wallet in Nimiq Pay or Hub, review the proof, then tap Pay hunter in
          NIM. The wallet confirms. NIM sends with memo <code>BOUNTY:&lt;id&gt;:PAID</code>. If the wallet rejects or no
          hash comes back, the bounty stays submitted. Retry is available.
        </p>
      </section>

      <section id="receipt" className="docs-block">
        <h2>Receipts</h2>
        <p>
          After a real tx hash, open <code>/b/:id/receipt</code>. It shows poster, hunter, amount, asset, time, and an
          explorer link. Screenshot it. That is the proof of payment.
        </p>
      </section>

      <section className="docs-block">
        <h2>Wallets</h2>
        <p>
          Inside Nimiq Pay the wallet connects on launch. On desktop, Connect opens Nimiq Hub. Profiles are keyed to the
          wallet. Username and photo live on the shared board, not only on your phone.
        </p>
      </section>

      <section className="docs-block">
        <h2>Open in Nimiq Pay</h2>
        <p>
          Official listing:{' '}
          <a href={PAY_MINIAPP_URL} target="_blank" rel="noreferrer">
            Open in Nimiq Pay
          </a>
          . Live web app:{' '}
          <a href="https://bounty-board.xyz/" target="_blank" rel="noreferrer">
            bounty-board.xyz
          </a>
          .
        </p>
      </section>
    </main>
  )
}
