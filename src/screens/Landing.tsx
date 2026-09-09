import type { BoardStats, Bounty } from '@shared/types.ts'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { OpenInNimiqPay, SiteFooter } from '../components/PayLaunch.tsx'
import { listAllBounties, listBounties } from '../lib/api.ts'

const EMPTY: BoardStats = { live: 0, review: 0, paid: 0, likes: 0 }

const STEPS = [
  {
    n: '01',
    title: 'Post',
    body: 'Need something done? Write the task, set a NIM reward, and put it on the board.',
  },
  {
    n: '02',
    title: 'Complete',
    body: 'Want to earn? Pick a bounty, do the work, and send proof. The poster reviews it.',
  },
  {
    n: '03',
    title: 'Get paid',
    body: 'The poster pays from their wallet in NIM. You get the reward. The receipt is the payment.',
  },
]

const FEATURES = [
  {
    title: 'Two sides, one board',
    body: 'Post a task you need done, or browse open bounties and earn. Same board, same payment.',
  },
  {
    title: 'Paid in NIM',
    body: 'Every bounty has a NIM reward. When the work is accepted, payment goes wallet to wallet in Nimiq Pay.',
  },
  {
    title: 'You pay when it’s done',
    body: 'The reward stays in your wallet until you accept the work and send it. Board never holds the money.',
  },
  {
    title: 'A receipt you can keep',
    body: 'Each payment records who posted, who did the work, the amount, and the transaction. Screenshot it and you’re done.',
  },
]

const FAQS = [
  {
    q: 'What is Bounty Board?',
    a: 'A board for two kinds of people: those who need a task done, and those who want to earn NIM for doing it. Post a bounty or pick one up.',
  },
  {
    q: 'How do I post a task?',
    a: 'Write what you need, set a NIM reward, and publish. People send proof. You review it, then pay from your wallet.',
  },
  {
    q: 'How do I earn?',
    a: 'Open the board, choose a bounty, complete the work, and submit proof. When the poster accepts it, they pay you in NIM.',
  },
  {
    q: 'Does Board hold the money?',
    a: 'No. Funds stay in the poster\'s wallet until they pay. There is no escrow and no middleman payout.',
  },
  {
    q: 'What if nobody finishes?',
    a: 'The bounty expires. Nothing is locked. Repost it, change the task, or raise the reward.',
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
        <p className="land-eyebrow">Need it done. Want to earn.</p>
        <h1>
          Get things done.
          <em> Get paid in NIM.</em>
        </h1>
        <p className="land-lead">
          Post a task with a reward, or pick up a bounty and earn for your work. Bounty Board turns
          everyday tasks into earning opportunities with Nimiq.
        </p>
        <p className="land-sub">
          From bug reports and design work to research and community tasks — if it needs doing, put a
          bounty on it.
        </p>
        <div className="land-cta">
          <Link to="/bounties?create=1" className="btn-accent land-cta-main no-underline">
            Post a Bounty
          </Link>
          <Link to="/bounties" className="btn-ghost land-cta-main no-underline">
            Find a Bounty
          </Link>
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
          Post. Complete.
          <em> Get paid.</em>
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
          Need it done.
          <em> Want to earn.</em>
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
          Post a task.
          <em> Or pick one up.</em>
        </h2>
        <p>Someone needs something done. Someone else wants to earn. Start on either side.</p>
        <div className="land-cta">
          <Link to="/bounties?create=1" className="btn-accent land-cta-main no-underline">
            Post a Bounty
          </Link>
          <Link to="/bounties" className="btn-ghost land-cta-main no-underline">
            Find a Bounty
          </Link>
          <OpenInNimiqPay className="btn-ghost land-cta-main no-underline" />
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
