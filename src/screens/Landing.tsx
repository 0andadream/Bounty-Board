import type { BoardStats, Bounty } from '@shared/types.ts'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { OpenInNimiqPay, SiteFooter } from '../components/PayLaunch.tsx'
import { listAllBounties, listBounties } from '../lib/api.ts'

const EMPTY: BoardStats = { live: 0, review: 0, paid: 0, likes: 0 }

const STEPS = [
  { n: '01', title: 'Post the spec', body: 'Title, deliverables, duration, and a reward. That spec is the rulebook.' },
  { n: '02', title: 'Hunters submit', body: 'Anyone with a wallet can send proof. You review the entry, not a middleman.' },
  { n: '03', title: 'Pay the winner', body: 'You set how many hunters win. You pay each one wallet to wallet. The receipt is the point. No escrow.' },
]

const FEATURES = [
  { title: 'No escrow', body: 'Funds stay in your wallet until you accept the work and send payment.' },
  { title: 'You pick the winners', body: 'Set 1–10 winners. You pay each hunter wallet-to-wallet. Boost the pool if you want more heat on the spec.' },
  { title: 'NIM first', body: 'Post in NIM on Nimiq Pay. USDT on Polygon is the optional extra. Same board, same receipt.' },
  { title: 'Onchain receipt', body: 'When you pay, the tx hash is the proof. Public, shareable, done.' },
]

const FAQS = [
  {
    q: 'Is there escrow?',
    a: 'No. You post the bounty, hunters submit work, and you pay the winner from your wallet. Board never holds the reward.',
  },
  {
    q: 'Who decides the winner?',
    a: 'You do. You set how many hunters can win. You check each proof, then pay that hunter. There is no moderator payout.',
  },
  {
    q: 'How do hunters get paid?',
    a: 'Directly. The poster sends NIM or USDT to the hunter wallet. Board stores the transaction hash as the receipt.',
  },
  {
    q: 'What wallets work?',
    a: 'Nimiq Hub or Nimiq Pay for NIM. An EVM wallet on Polygon for USDT. Connect once and post, hunt, or pay.',
  },
  {
    q: 'What if nobody finishes?',
    a: 'The bounty expires. Nothing is locked. Repost it, change the spec, or raise the reward.',
  },
]

export function Landing() {
  const [stats, setStats] = useState<BoardStats>(EMPTY)
  const [openTitles, setOpenTitles] = useState<string[]>([])
  const [faq, setFaq] = useState<number | null>(0)

  useEffect(() => {
    let ignore = false
    Promise.all([listBounties('open', { sort: 'reward' }), listAllBounties()])
      .then(([feed, all]) => {
        if (ignore) return
        setStats(feed.stats)
        setOpenTitles(all.filter((row: Bounty) => row.status === 'open').slice(0, 8).map((row) => row.title))
      })
      .catch(() => undefined)
    return () => {
      ignore = true
    }
  }, [])

  return (
    <div className="landing">
      <header className="land-top">
        <Link to="/" className="brand" aria-label="Bounty Board">
          <span className="brand-word">BOUNTY BOARD</span>
        </Link>
        <div className="land-top-actions">
          <Link to="/bounties" className="btn-ghost no-underline">
            Open board
          </Link>
          <Link to="/bounties?create=1" className="btn-accent no-underline land-create">
            <span aria-hidden="true">+</span> Create
          </Link>
        </div>
      </header>

      <section className="land-hero">
        <p className="land-eyebrow">Pay anyone to do anything</p>
        <h1>
          Get the work
          <em> done.</em>
        </h1>
        <p className="land-lead">
          Post a bounty. One hunter ships it. You pay them wallet to wallet. No escrow, no committee,
          just a spec and a receipt.
        </p>
        <p className="land-sub">NIM in Nimiq Pay. No escrow. The receipt is the tx.</p>
        <div className="land-cta">
          <Link to="/bounties" className="btn-accent land-cta-main no-underline">
            Open board
          </Link>
          <OpenInNimiqPay className="btn-ghost land-cta-main no-underline" />
        </div>
      </section>

      {openTitles.length > 0 ? (
        <div className="land-ticker" aria-hidden="true">
          <div className="land-ticker-track">
            {[...openTitles, ...openTitles].map((title, index) => (
              <span key={`${title}-${index}`}>{title}</span>
            ))}
          </div>
        </div>
      ) : null}

      <section className="land-pool">
        <p className="land-kicker">On the board right now</p>
        {stats.live === 0 && stats.review === 0 && stats.paid === 0 ? (
          <div className="land-cta">
            <Link to="/bounties?create=1" className="btn-accent land-cta-main no-underline">
              Post the first bounty — 2 min
            </Link>
          </div>
        ) : (
          <div className="land-stats">
            <div>
              <strong>{stats.live}</strong>
              <span>Live bounties</span>
            </div>
            <div>
              <strong>{stats.review}</strong>
              <span>In review</span>
            </div>
            <div>
              <strong>{stats.paid}</strong>
              <span>Paid out</span>
            </div>
            <div>
              <strong>{stats.likes}</strong>
              <span>Likes</span>
            </div>
          </div>
        )}
      </section>

      <section className="land-steps">
        <p className="land-kicker">How it works</p>
        <h2>
          Post small.
          <em> Pay once.</em>
        </h2>
        <div className="land-step-grid">
          {STEPS.map((step) => (
            <article key={step.n}>
              <span>{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="land-features">
        <p className="land-kicker">Why Board</p>
        <h2>
          No vault.
          <em> Just payment.</em>
        </h2>
        <div className="land-feature-grid">
          {FEATURES.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="land-faq">
        <p className="land-kicker">FAQs</p>
        <h2>Straight answers</h2>
        <div className="land-faq-list">
          {FAQS.map((item, index) => {
            const open = faq === index
            return (
              <button
                key={item.q}
                type="button"
                className={`land-faq-item ${open ? 'on' : ''}`}
                onClick={() => setFaq(open ? null : index)}
              >
                <span>
                  {item.q}
                  <i aria-hidden="true">{open ? '–' : '+'}</i>
                </span>
                {open ? <p>{item.a}</p> : null}
              </button>
            )
          })}
        </div>
      </section>

      <section className="land-end">
        <h2>
          Ready when
          <em> you are.</em>
        </h2>
        <p>Open the board, post a spec, or hunt what’s already live.</p>
        <div className="land-cta">
          <Link to="/bounties" className="btn-accent land-cta-main no-underline">
            Open board
          </Link>
          <OpenInNimiqPay className="btn-ghost land-cta-main no-underline" />
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
