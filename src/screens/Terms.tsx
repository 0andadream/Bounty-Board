import { Link } from 'react-router-dom'
import { BackKey } from '../components/BackKey.tsx'

export function Terms() {
  return (
    <main className="screen docs-page">
      <BackKey />
      <p className="pool-kicker mt-0 mb-2">Legal</p>
      <h1 className="mt-0 mb-3 text-[36px] tracking-[-0.05em]">Terms of Service</h1>
      <p className="mt-0 mb-6 text-[14px] text-muted">Last updated 10 Sep 2026.</p>
      <section className="docs-block">
        <h2>What Board is</h2>
        <p>
          Bounty Board is a ticket between a poster and a hunter. You post a task and a reward. Someone submits proof.
          You pay from your own wallet. Board does not custody funds, does not run a dispute court, and does not
          guarantee that a poster will pay.
        </p>
      </section>
      <section className="docs-block">
        <h2>Your wallet</h2>
        <p>
          Connecting a wallet is how you identify yourself. You are responsible for the keys, the payments you send, and
          the proof you submit. Do not post or submit illegal, harmful, or prohibited content.
        </p>
      </section>
      <section className="docs-block">
        <h2>License</h2>
        <p>
          The app is released under the MIT License. See <Link to="/privacy">Privacy</Link> for how wallet data is
          stored.
        </p>
      </section>
    </main>
  )
}
