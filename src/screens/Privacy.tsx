import { BackKey } from '../components/BackKey.tsx'

export function Privacy() {
  return (
    <main className="screen docs-page">
      <BackKey />
      <p className="pool-kicker mt-0 mb-2">Legal</p>
      <h1 className="mt-0 mb-3 text-[36px] tracking-[-0.05em]">Privacy Policy</h1>
      <p className="mt-0 mb-6 text-[14px] text-muted">Last updated 10 Sep 2026.</p>
      <section className="docs-block">
        <h2>What we store</h2>
        <p>
          Board does not ask for email or a password. Identity is the wallet you connect. Cloudflare D1 stores bounty
          tickets (title, spec, reward, wallets, proof, tx hash) and optional profile fields you set: username, photo,
          cover, location, skills.
        </p>
      </section>
      <section className="docs-block">
        <h2>What we do not store</h2>
        <p>
          Private keys never leave Nimiq Pay or Hub. Board does not hold balances. Proof videos and PDFs stay behind the
          links you paste. Photos you attach are stored as compressed images on the ticket.
        </p>
      </section>
      <section className="docs-block">
        <h2>Public by design</h2>
        <p>
          The board, receipts, and public profiles are meant to be seen. Do not put secrets in a spec, a username, or a
          proof note.
        </p>
      </section>
    </main>
  )
}
