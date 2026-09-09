import { likeWalletKey } from './address.ts'
import type { Bounty, PosterTrust } from './types.ts'

/** Documented demo poster. Seed bounties use this NIM address. Pay still goes hunter-to-hunter. */
export const DEMO_POSTER = 'NQ30 A7HU XB26 K9H2 QFHT MB58 A0G1 DEXQ CSG5'

const AWAIT_MS = 48 * 60 * 60 * 1000

export function emptyTrust(): PosterTrust {
  return {
    posted: 0,
    paid: 0,
    completed: 0,
    unpaid: 0,
    settledNim: '0',
    settledUsdt: '0',
    likes: 0,
  }
}

export function trustMap(bounties: Bounty[]): Map<string, PosterTrust> {
  const map = new Map<string, PosterTrust>()
  for (const bounty of bounties) {
    const key = likeWalletKey(bounty.poster)
    const row = map.get(key) ?? emptyTrust()
    row.posted += 1
    row.likes += bounty.likes ?? 0
    if (bounty.status === 'paid') {
      row.paid += 1
      row.completed += 1
      if (bounty.token === 'USDT') {
        row.settledUsdt = (BigInt(row.settledUsdt) + BigInt(bounty.rewardMinor)).toString()
      } else {
        row.settledNim = (BigInt(row.settledNim) + BigInt(bounty.rewardMinor)).toString()
      }
    } else if (bounty.status === 'submitted') {
      row.completed += 1
      row.unpaid += 1
    }
    map.set(key, row)
  }
  return map
}

export function trustForPoster(bounties: Bounty[], poster: string): PosterTrust {
  return trustMap(bounties).get(likeWalletKey(poster)) ?? emptyTrust()
}

export function posterPaidLabel(trust?: PosterTrust | null): string {
  if (!trust || trust.posted === 0) return 'New poster'
  if (trust.completed === 0) return `Posted ${trust.posted} · no completed bounties yet`
  return `Poster paid ${trust.paid}/${trust.completed} completed bounties`
}

export function awaitingPay(bounty: Pick<Bounty, 'status' | 'submittedAt'>, now: number): boolean {
  if (bounty.status !== 'submitted' || !bounty.submittedAt) return false
  return now - bounty.submittedAt >= AWAIT_MS
}
