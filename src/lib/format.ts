import { formatNimiqAddress, shortenWallet } from '@shared/address.ts'
import { minorToDisplay } from '@shared/money.ts'
import type { Bounty, Profile, Token } from '@shared/types.ts'

export type ActivityKind = 'posted' | 'claimed' | 'submitted' | 'paid'

export type Activity = {
  id: string
  kind: ActivityKind
  at: number
  bounty: Bounty
}

export function money(amountMinor: bigint | string, token: Token): string {
  return `${minorToDisplay(amountMinor, token)} ${token}`
}

export function formatWallet(token: Token, value: string): string {
  return token === 'NIM' ? formatNimiqAddress(value) : value
}

export function shortWallet(token: Token, value: string): string {
  return shortenWallet(token, value)
}

export function formatWhen(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(ts)
}

export function countdownClock(deadline: number, now: number): string {
  const ms = deadline - now
  if (ms <= 0) return 'Ended'
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  if (days >= 1) return `${days}d ${hours}h ${pad(minutes)}m ${pad(seconds)}s`
  if (hours >= 1) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`
  return `${minutes}m ${pad(seconds)}s`
}

export function timeProgress(createdAt: number, deadline: number, now: number): number {
  const total = deadline - createdAt
  if (total <= 0) return 1
  return Math.min(1, Math.max(0, (now - createdAt) / total))
}

export function dueLabel(deadline: number, now: number): string {
  const ms = deadline - now
  if (ms <= 0) return 'Ended'
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  if (days >= 1) return `${days}d ${String(hours).padStart(2, '0')}h left`
  if (hours >= 1) return `${hours}h ${minutes}m left`
  if (minutes >= 1) return `${minutes}m left`
  return 'Ending now'
}

export function endingSoon(deadline: number, now: number): boolean {
  const ms = deadline - now
  return ms > 0 && ms <= 24 * 60 * 60 * 1000
}

export function statusLabel(status: string): string {
  if (status === 'open') return 'Open'
  if (status === 'claimed' || status === 'submitted') return 'In review'
  if (status === 'paid') return 'Completed'
  if (status === 'expired') return 'Ended'
  return status
}

export function amountNumber(amountMinor: bigint | string, token: Token): string {
  return minorToDisplay(amountMinor, token)
}

export function submissionsCount(bounty: { hunter: string | null }): number {
  return bounty.hunter ? 1 : 0
}

export function subsLabel(count: number): string {
  return count === 1 ? '1 sub.' : `${count} subs.`
}

export function timeAgo(ts: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - ts) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function activitiesFromBounties(bounties: Bounty[], limit = 16): Activity[] {
  const items: Activity[] = []
  for (const bounty of bounties) {
    items.push({ id: `${bounty.id}-posted`, kind: 'posted', at: bounty.createdAt, bounty })
    if (bounty.claimedAt) {
      items.push({ id: `${bounty.id}-claimed`, kind: 'claimed', at: bounty.claimedAt, bounty })
    }
    if (bounty.submittedAt) {
      items.push({ id: `${bounty.id}-submitted`, kind: 'submitted', at: bounty.submittedAt, bounty })
    }
    if (bounty.paidAt) {
      items.push({ id: `${bounty.id}-paid`, kind: 'paid', at: bounty.paidAt, bounty })
    }
  }
  return items.sort((a, b) => b.at - a.at).slice(0, limit)
}

export function activityVerb(kind: ActivityKind): string {
  if (kind === 'posted') return 'posted'
  if (kind === 'claimed') return 'claimed'
  if (kind === 'submitted') return 'submitted'
  return 'got paid'
}

export function actorName(token: Token, wallet: string, profile?: Profile | null): string {
  return profile?.username ?? shortWallet(token, wallet)
}

export function activityActor(item: Activity): string {
  const posted = item.kind === 'posted'
  const wallet = posted ? item.bounty.poster : (item.bounty.hunter ?? item.bounty.poster)
  const profile = posted ? item.bounty.posterProfile : item.bounty.hunterProfile
  return actorName(item.bounty.token, wallet, profile)
}

export function activityWallet(item: Activity): string {
  return item.kind === 'posted' ? item.bounty.poster : (item.bounty.hunter ?? item.bounty.poster)
}

export function activityProfile(item: Activity): Profile | null | undefined {
  return item.kind === 'posted' ? item.bounty.posterProfile : item.bounty.hunterProfile
}

export function activityHref(item: Activity): string {
  return item.kind === 'paid' ? `/b/${item.bounty.id}/receipt` : `/b/${item.bounty.id}`
}

export type BoardLeader = {
  wallet: string
  profile?: Profile | null
  token: Token
  amountMinor: bigint
  count: number
}

export function topOpenBounties(bounties: Bounty[], now: number, limit = 3): Bounty[] {
  return bounties
    .filter((bounty) => bounty.status === 'open' && bounty.deadline > now)
    .sort((a, b) => Number(BigInt(b.rewardMinor) - BigInt(a.rewardMinor)))
    .slice(0, limit)
}

export function recentPayouts(bounties: Bounty[], limit = 6): Bounty[] {
  return bounties
    .filter((bounty) => bounty.status === 'paid' && bounty.hunter && bounty.paidAt)
    .sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0))
    .slice(0, limit)
}

export function paidLeaders(
  bounties: Bounty[],
  role: 'hunter' | 'poster',
  since: number,
  limit = 5,
): BoardLeader[] {
  const map = new Map<string, BoardLeader>()
  for (const bounty of bounties) {
    if (bounty.status !== 'paid' || !bounty.paidAt || bounty.paidAt < since) continue
    const wallet = role === 'hunter' ? bounty.hunter : bounty.poster
    if (!wallet) continue
    const profile = role === 'hunter' ? bounty.hunterProfile : bounty.posterProfile
    const current = map.get(wallet)
    if (!current) {
      map.set(wallet, {
        wallet,
        profile,
        token: bounty.token,
        amountMinor: BigInt(bounty.rewardMinor),
        count: 1,
      })
      continue
    }
    current.count += 1
    if (current.token === bounty.token) current.amountMinor += BigInt(bounty.rewardMinor)
  }
  return [...map.values()]
    .sort((a, b) => {
      const amount = b.amountMinor - a.amountMinor
      if (amount !== 0n) return amount > 0n ? 1 : -1
      return b.count - a.count
    })
    .slice(0, limit)
}

export function formatDeadline(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(ts)
}

export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const node = document.createElement('textarea')
  node.value = value
  node.setAttribute('readonly', '')
  node.style.position = 'fixed'
  node.style.opacity = '0'
  document.body.appendChild(node)
  node.select()
  document.execCommand('copy')
  document.body.removeChild(node)
}

export function publicOrigin(): string {
  const configured = (import.meta.env.VITE_APP_URL ?? '').replace(/\/$/, '')
  if (configured) return configured
  return window.location.origin
}

export function receiptUrl(id: string): string {
  return `${publicOrigin()}/b/${id}/receipt`
}

export function explorerUrl(token: Token, txHash: string): string | null {
  if (token === 'USDT' && txHash.startsWith('0x')) {
    return `https://polygonscan.com/tx/${txHash}`
  }
  if (/^[0-9a-fA-F]{64}$/.test(txHash)) {
    return `https://v2.nimiqwatch.com/tx/${txHash}`
  }
  return null
}
