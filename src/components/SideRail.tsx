import type { Bounty } from '@shared/types.ts'
import { Link } from 'react-router-dom'
import {
  actorName,
  amountNumber,
  dueLabel,
  money,
  paidLeaders,
  recentPayouts,
  submissionsCount,
  subsLabel,
  topOpenBounties,
} from '../lib/format.ts'
import { Avatar } from './ui.tsx'

export function SideRail({
  bounties,
  now,
  onOpenAll,
}: {
  bounties: Bounty[]
  now: number
  onOpenAll: () => void
}) {
  const open = topOpenBounties(bounties, now, 3)
  const featured = open[0]
  const rest = open.slice(1)
  const payouts = recentPayouts(bounties, 6)
  const since = now - 30 * 86_400_000
  const earners = paidLeaders(bounties, 'hunter', since, 5)
  const spenders = paidLeaders(bounties, 'poster', since, 5)
  const spendMax = spenders[0]?.amountMinor ?? 1n

  return (
    <aside className="side-rail">
      <Link to="/bounties?create=1" className="btn-accent rail-create no-underline">
        <span aria-hidden="true">+</span> Create bounty
      </Link>

      <section className="rail-card">
        <div className="rail-card-head">
          <p>
            <span className="rail-ico" aria-hidden="true">
              ⌂
            </span>
            Highest reward · Open
          </p>
          <button type="button" className="rail-link" onClick={onOpenAll}>
            All open →
          </button>
        </div>
        {featured ? (
          <Link to={`/b/${featured.id}`} className="rail-featured">
            <p className="rail-kicker">
              <span>1</span> Top open bounty
            </p>
            <p className="rail-amount">{amountNumber(featured.rewardMinor, featured.token)}</p>
            <p className="rail-featured-title">{featured.title}</p>
            <p className="rail-featured-meta">
              {featured.token} · {dueLabel(featured.deadline, now)} · {subsLabel(submissionsCount(featured))}
            </p>
          </Link>
        ) : (
          <p className="rail-empty">No open bounties yet.</p>
        )}
        {rest.map((bounty, index) => (
          <Link key={bounty.id} to={`/b/${bounty.id}`} className="rail-row">
            <span className="rail-rank">{index + 2}</span>
            <span className="rail-row-copy">
              <strong>{bounty.title}</strong>
              <em>{dueLabel(bounty.deadline, now)}</em>
            </span>
            <span className="rail-row-pay">{amountNumber(bounty.rewardMinor, bounty.token)}</span>
          </Link>
        ))}
      </section>

      <section className="rail-card">
        <div className="rail-card-head">
          <p>
            <span className="rail-ico" aria-hidden="true">
              $
            </span>
            Recent payouts
          </p>
          <span className="activity-dot" aria-hidden="true" />
        </div>
        {payouts.length === 0 ? (
          <p className="rail-empty">No payouts yet.</p>
        ) : (
          payouts.map((bounty) => (
            <Link key={bounty.id} to={`/b/${bounty.id}/receipt`} className="rail-person">
              <Avatar
                profile={bounty.hunterProfile}
                wallet={bounty.hunter ?? bounty.poster}
              />
              <span className="rail-person-name">
                {actorName(bounty.token, bounty.hunter ?? bounty.poster, bounty.hunterProfile)}
              </span>
              <span className="rail-plus">+{money(bounty.rewardMinor, bounty.token)}</span>
            </Link>
          ))
        )}
      </section>

      <section className="rail-card">
        <div className="rail-card-head">
          <p>
            <span className="rail-ico" aria-hidden="true">
              ↑
            </span>
            Highest earners · 30d
          </p>
        </div>
        {earners.length === 0 ? (
          <p className="rail-empty">No earners in the last 30 days.</p>
        ) : (
          earners.map((row) => (
            <div key={row.wallet} className="rail-person">
              <Avatar profile={row.profile} wallet={row.wallet} />
              <span className="rail-person-copy">
                <strong>{actorName(row.token, row.wallet, row.profile)}</strong>
                <em>
                  {row.count} {row.count === 1 ? 'payout' : 'payouts'}
                </em>
              </span>
              <span className="rail-row-pay">{amountNumber(row.amountMinor, row.token)}</span>
            </div>
          ))
        )}
      </section>

      <section className="rail-card">
        <div className="rail-card-head">
          <p>
            <span className="rail-ico" aria-hidden="true">
              ↓
            </span>
            Highest spenders · 30d
          </p>
        </div>
        {spenders.length === 0 ? (
          <p className="rail-empty">No spenders in the last 30 days.</p>
        ) : (
          spenders.map((row, index) => (
            <div key={row.wallet} className="rail-spend">
              <div className="rail-person">
                <span className="rail-rank">{index + 1}</span>
                <Avatar profile={row.profile} wallet={row.wallet} />
                <span className="rail-person-name">{actorName(row.token, row.wallet, row.profile)}</span>
                <span className="rail-spend-count">
                  {row.count} {row.count === 1 ? 'payout' : 'payouts'}
                </span>
                <span className="rail-row-pay">{amountNumber(row.amountMinor, row.token)}</span>
              </div>
              <span className="rail-bar">
                <span style={{ width: `${barWidth(row.amountMinor, spendMax)}%` }} />
              </span>
            </div>
          ))
        )}
      </section>
    </aside>
  )
}

function barWidth(amount: bigint, max: bigint): number {
  if (max <= 0n) return 0
  return Math.max(8, Math.min(100, Number((amount * 100n) / max)))
}
