import type { BoardStats, Bounty, BountyListTab, BountySort, Profile } from '@shared/types.ts'
import { AppError } from './errors.ts'

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

type ApiErrorBody = {
  error?: string
  code?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 12_000)

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
      signal: controller.signal,
    })

    const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody
    if (!response.ok) {
      const mapped =
        body.code === 'already_claimed'
          ? 'already_claimed'
          : body.code === 'expired'
            ? 'expired'
            : body.code === 'not_found'
              ? 'not_found'
              : body.code === 'username_taken'
                ? 'username_taken'
              : response.status >= 500
                ? 'backend_unavailable'
                : 'bad_request'
      throw new AppError(mapped, body.error || 'Request failed', mapped !== 'not_found')
    }
    return body
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(
      'backend_unavailable',
      'Board cannot reach the server right now. Check your connection and retry.',
      true,
    )
  } finally {
    window.clearTimeout(timer)
  }
}

function viewerQuery(viewer?: string | null): string {
  return viewer ? `&viewer=${encodeURIComponent(viewer)}` : ''
}

export async function listBounties(
  tab: BountyListTab,
  opts: { sort?: BountySort; viewer?: string | null } = {},
): Promise<{ bounties: Bounty[]; stats: BoardStats }> {
  const sort = opts.sort ?? 'new'
  const body = await request<{ bounties: Bounty[]; stats: BoardStats }>(
    `/api/bounties?tab=${tab}&sort=${sort}${viewerQuery(opts.viewer)}`,
  )
  return body
}

export async function listAllBounties(viewer?: string | null): Promise<Bounty[]> {
  const body = await request<{ bounties: Bounty[] }>(
    `/api/bounties?tab=all&sort=new${viewerQuery(viewer)}`,
  )
  return body.bounties
}

export async function listMyBounties(address: string, viewer?: string | null): Promise<Bounty[]> {
  const body = await request<{ bounties: Bounty[] }>(
    `/api/bounties?address=${encodeURIComponent(address)}${viewerQuery(viewer)}`,
  )
  return body.bounties
}

export async function getBounty(id: string, viewer?: string | null): Promise<Bounty> {
  const body = await request<{ bounty: Bounty }>(`/api/bounties/${id}?x=1${viewerQuery(viewer)}`)
  return body.bounty
}

export async function toggleLike(id: string, wallet: string): Promise<Bounty> {
  const body = await request<{ bounty: Bounty }>(`/api/bounties/${id}/like`, {
    method: 'POST',
    body: JSON.stringify({ wallet }),
  })
  return body.bounty
}

export async function postBounty(input: {
  title: string
  brief: string
  rewardMinor: string
  token: Bounty['token']
  deadline: number
  poster: string
  imageUrl?: string | null
  proofType?: Bounty['proofType']
}): Promise<Bounty> {
  const body = await request<{ bounty: Bounty }>('/api/bounties', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return body.bounty
}

export async function claimBounty(id: string, hunter: string): Promise<Bounty> {
  const body = await request<{ bounty: Bounty }>(`/api/bounties/${id}/claim`, {
    method: 'POST',
    body: JSON.stringify({ hunter }),
  })
  return body.bounty
}

export async function submitProof(
  id: string,
  hunter: string,
  proof: string,
  extra: { note?: string; image?: string | null } = {},
): Promise<Bounty> {
  const body = await request<{ bounty: Bounty }>(`/api/bounties/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ hunter, proof, note: extra.note ?? '', image: extra.image ?? null }),
  })
  return body.bounty
}

export async function getProfileByWallet(wallet: string): Promise<Profile | null> {
  const body = await request<{ profile: Profile | null }>(`/api/profiles?wallet=${encodeURIComponent(wallet)}`)
  return body.profile
}

export async function getProfileByUsername(username: string): Promise<Profile> {
  const body = await request<{ profile: Profile }>(`/api/profiles?username=${encodeURIComponent(username)}`)
  if (!body.profile) throw new AppError('not_found', 'Profile not found.', false)
  return body.profile
}

export async function saveProfile(input: {
  wallet: string
  username: string
  avatarUrl?: string | null
  coverUrl?: string | null
  location?: string | null
  skills?: string | null
}): Promise<Profile> {
  const body = await request<{ profile: Profile }>('/api/profiles', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return body.profile
}

export async function boostBounty(id: string, wallet: string, amountMinor: string): Promise<Bounty> {
  const body = await request<{ bounty: Bounty }>(`/api/bounties/${id}/boost`, {
    method: 'POST',
    body: JSON.stringify({ wallet, amountMinor }),
  })
  return body.bounty
}

export async function markPaid(
  id: string,
  poster: string,
  txHash: string,
  asset: Bounty['token'] = 'NIM',
): Promise<Bounty> {
  const body = await request<{ bounty: Bounty }>(`/api/bounties/${id}/pay`, {
    method: 'POST',
    body: JSON.stringify({ poster, txHash, asset }),
  })
  return body.bounty
}
