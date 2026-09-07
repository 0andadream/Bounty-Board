import type { Bounty, Profile } from '@shared/types.ts'
import { type ReactNode } from 'react'
import { money } from '../lib/format.ts'
import { Avatar, BountyCard, EmptyTicket, FeedHead } from './ui.tsx'

export type ProfileTab = 'work' | 'details'

export function profileHandle(username: string): string {
  const value = username.trim() || 'yourname'
  return `@${value.toLowerCase()}`
}

export function earnedLabel(bounties: Bounty[]): string {
  const paid = bounties.filter((bounty) => bounty.status === 'paid')
  if (paid.length === 0) return '0'
  const byToken = new Map<string, bigint>()
  for (const bounty of paid) {
    byToken.set(bounty.token, (byToken.get(bounty.token) ?? 0n) + BigInt(bounty.rewardMinor))
  }
  return [...byToken.entries()]
    .map(([token, amount]) => money(amount, bountyToken(token)))
    .join(' · ')
}

function bountyToken(token: string): Bounty['token'] {
  return token === 'USDT' ? 'USDT' : 'NIM'
}

export function completedCount(bounties: Bounty[]): number {
  return bounties.filter((bounty) => bounty.status === 'paid').length
}

export function ProfileStage({
  wallet,
  username,
  avatarUrl,
  coverUrl,
  location,
  skills,
  own,
  editing,
  tab,
  posted,
  claimed,
  completed,
  earned,
  now,
  shared,
  onTab,
  onEdit,
  onShare,
  onPickCover,
  onPickAvatar,
  extra,
  editLabel,
}: {
  wallet: string
  username: string
  avatarUrl: string | null
  coverUrl: string | null
  location: string | null
  skills: string | null
  own?: boolean
  editing?: boolean
  tab: ProfileTab
  posted: Bounty[]
  claimed: Bounty[]
  completed: number
  earned: string
  now: number
  shared?: boolean
  onTab: (tab: ProfileTab) => void
  onEdit?: () => void
  onShare?: () => void
  onPickCover?: (file: File) => void
  onPickAvatar?: (file: File) => void
  extra?: ReactNode
  editLabel?: string
}) {
  const draft: Profile = {
    wallet,
    username: username || 'yourname',
    avatarUrl,
    coverUrl,
    location,
    skills,
  }
  const work = [...posted, ...claimed]
  const unique = [...new Map(work.map((row) => [row.id, row])).values()]

  return (
    <div className="profile-stage">
      <section className="profile-hero">
        <div className="profile-cover">
          {coverUrl ? <img src={coverUrl} alt="" /> : <span className="profile-cover-pattern" aria-hidden="true" />}
          {editing && onPickCover ? (
            <label className="profile-cover-edit">
              Change cover
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) onPickCover(file)
                }}
              />
            </label>
          ) : null}
        </div>
        <div className="profile-identity">
          <div className="profile-avatar-wrap">
            <Avatar profile={draft} wallet={wallet} size="xl" />
            {editing && onPickAvatar ? (
              <label className="profile-avatar-edit">
                Change photo
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) onPickAvatar(file)
                  }}
                />
              </label>
            ) : null}
          </div>
          <h1 className="profile-name">{username || 'yourname'}</h1>
          <p className="profile-handle">{profileHandle(username)}</p>
          <div className="profile-actions">
            {own && editLabel !== undefined ? (
              <button type="button" className="btn-ghost" onClick={onEdit}>
                {editLabel}
              </button>
            ) : null}
            <button
              type="button"
              className="btn-ghost profile-share"
              onClick={onShare}
              aria-label="Share profile"
              title="Share profile"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="12" cy="3.5" r="1.7" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="4" cy="8" r="1.7" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="12" cy="12.5" r="1.7" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5.5 7.2 10.4 4.3M5.5 8.8l4.9 2.9" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
          </div>
          {shared ? <p className="profile-shared">Link copied.</p> : null}
        </div>
      </section>

      <nav className="profile-tabs" aria-label="Profile sections">
        <button type="button" className={tab === 'work' ? 'on' : ''} onClick={() => onTab('work')}>
          Work
        </button>
        <button type="button" className={tab === 'details' ? 'on' : ''} onClick={() => onTab('details')}>
          Details
        </button>
      </nav>

      {tab === 'work' ? (
        <div className="profile-work">
          <h2 className="profile-section-title">Posted</h2>
          {posted.length === 0 ? (
            <EmptyTicket>No posted bounties.</EmptyTicket>
          ) : (
            <div className="feed mb-8">
              <FeedHead />
              {posted.map((bounty) => (
                <BountyCard key={bounty.id} bounty={bounty} now={now} />
              ))}
            </div>
          )}
          <h2 className="profile-section-title">Claimed</h2>
          {claimed.length === 0 ? (
            <EmptyTicket>No claimed bounties.</EmptyTicket>
          ) : (
            <div className="feed">
              <FeedHead />
              {claimed.map((bounty) => (
                <BountyCard key={bounty.id} bounty={bounty} now={now} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <section className="profile-details">
          <div className="profile-details-head">
            <h2>Profile Details</h2>
            {own && !editing ? (
              <button type="button" className="profile-edit-link" onClick={onEdit}>
                Edit
              </button>
            ) : null}
          </div>
          <div className="profile-stats">
            <div>
              <span>Projects completed</span>
              <strong>{completed}</strong>
            </div>
            <div>
              <span>Amount earned</span>
              <strong>{earned}</strong>
            </div>
          </div>
          <dl className="profile-meta">
            <div>
              <dt>Location</dt>
              <dd>{location || '—'}</dd>
            </div>
            <div>
              <dt>Skills</dt>
              <dd>{skills || '—'}</dd>
            </div>
          </dl>
          {unique.length === 0 && !own ? (
            <p className="profile-empty-note">No bounties on this profile yet.</p>
          ) : null}
          {extra}
        </section>
      )}
    </div>
  )
}
