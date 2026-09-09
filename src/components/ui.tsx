import { viewStatus } from '@shared/machine.ts'
import { awaitingPay, posterPaidLabel } from '@shared/trust.ts'
import type { Bounty, Profile, ViewStatus } from '@shared/types.ts'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  actorName,
  amountNumber,
  dueLabel,
  endingSoon,
  formatWallet,
  shortWallet,
  statusLabel,
  submissionsCount,
  subsLabel,
} from '../lib/format.ts'

const MARKS = ['#d8ff3e', '#7dd3fc', '#f9a8d4', '#fdba74', '#a5b4fc', '#86efac']

export function markColor(id: string): string {
  let n = 0
  for (const char of id) n += char.charCodeAt(0)
  return MARKS[n % MARKS.length]
}

export function Stamp({ status, ending }: { status: ViewStatus; ending?: boolean }) {
  if (status === 'open' && ending) {
    return <span className="stamp stamp-soon">Ending soon</span>
  }
  return <span className={`stamp ${status === 'paid' ? 'stamp-paid' : ''}`}>{statusLabel(status)}</span>
}

export function LikeButton({
  likes,
  liked,
  onToggle,
}: {
  likes: number
  liked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`like-btn ${liked ? 'liked' : ''}`}
      aria-label={liked ? 'Unlike bounty' : 'Like bounty'}
      aria-pressed={liked}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
    >
      <span aria-hidden="true">{liked ? '♥' : '♡'}</span>
      <span>{likes}</span>
    </button>
  )
}

export function PersonLine({
  token,
  wallet,
  profile,
}: {
  token: Bounty['token']
  wallet: string
  profile?: Profile | null
}) {
  return (
    <div className="person-line">
      <Avatar profile={profile} wallet={wallet} />
      <div className="min-w-0">
        {profile ? (
          <Link to={`/u/${profile.username}`} className="no-underline font-semibold">
            {profile.username}
          </Link>
        ) : (
          <span className="font-semibold">{shortWallet(token, wallet)}</span>
        )}
        <p className="addr m-0 mt-1">{formatWallet(token, wallet)}</p>
      </div>
    </div>
  )
}

export function Avatar({
  profile,
  wallet,
  size = 'sm',
}: {
  profile?: Profile | null
  wallet: string
  size?: 'sm' | 'lg' | 'xl'
}) {
  const label = (profile?.username ?? wallet).replace(/\s+/g, '')
  return (
    <div
      className={`avatar ${size === 'lg' ? 'avatar-lg' : ''} ${size === 'xl' ? 'avatar-xl' : ''}`}
      style={{ background: markColor(wallet) }}
      aria-hidden="true"
    >
      {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{label.slice(0, 2)}</span>}
    </div>
  )
}

export function BountyThumb({ id, imageUrl }: { id: string; imageUrl?: string | null }) {
  const color = markColor(id)
  return (
    <div className="campaign-square" style={{ background: color }} aria-hidden="true">
      {imageUrl ? <img src={imageUrl} alt="" /> : <span>{id.slice(0, 2)}</span>}
    </div>
  )
}

export function FeedHead() {
  return (
    <div className="feed-head">
      <div className="feed-cols">
        <span>Status</span>
        <span>Bounty</span>
        <span>Reward</span>
        <span>Time left</span>
        <span>Submissions</span>
        <span>Likes</span>
      </div>
      <span className="feed-head-end" aria-hidden="true" />
    </div>
  )
}

export function BountyCard({
  bounty,
  now,
  onLike,
}: {
  bounty: Bounty
  now: number
  onLike?: (bounty: Bounty) => void
}) {
  const status = viewStatus(bounty, now)
  const soon = endingSoon(bounty.deadline, now)
  const subs = submissionsCount(bounty)
  return (
    <Link to={`/b/${bounty.id}`} className="campaign">
      <div className="campaign-main">
        <div className="col-status">
          <Stamp status={status} ending={soon} />
        </div>
        <div className="col-bounty">
          <h2 className="line-clamp-2">
            {bounty.demo ? <span className="demo-pill">Demo</span> : null}
            {bounty.title}
          </h2>
          <p>{actorName(bounty.token, bounty.poster, bounty.posterProfile)}</p>
          <p className="trust-mini">{posterPaidLabel(bounty.posterTrust)}</p>
          {awaitingPay(bounty, now) ? <p className="await-pill">Awaiting pay</p> : null}
        </div>
        <div className="col-reward">
          <p className="money">{amountNumber(bounty.rewardMinor, bounty.token)}</p>
          <p>{bounty.token}</p>
        </div>
        <div className="col-time">{dueLabel(bounty.deadline, now)}</div>
        <div className="col-subs">{subsLabel(subs)}</div>
        <div className="col-likes">
          <LikeButton likes={bounty.likes} liked={bounty.liked} onToggle={() => onLike?.(bounty)} />
        </div>
      </div>
      <BountyThumb id={bounty.id} imageUrl={bounty.imageUrl} />
    </Link>
  )
}

export function EmptyTicket({ children }: { children: ReactNode }) {
  return (
    <div className="panel text-center">
      <p className="m-0 text-[16px] text-muted">{children}</p>
    </div>
  )
}

export function Banner({ children }: { children: ReactNode }) {
  return <p className="mb-4 mt-0 panel text-[14px] text-muted">{children}</p>
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="mt-3 mb-0 text-[13px]" style={{ color: '#fb7185' }}>
      {message}
    </p>
  )
}
