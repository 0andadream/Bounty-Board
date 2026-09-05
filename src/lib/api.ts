import type { Bounty, BountyListTab } from '@shared/types.ts'
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

export async function listBounties(tab: BountyListTab): Promise<Bounty[]> {
  const body = await request<{ bounties: Bounty[] }>(`/api/bounties?tab=${tab}`)
  return body.bounties
}

export async function listMyBounties(address: string): Promise<Bounty[]> {
  const body = await request<{ bounties: Bounty[] }>(
    `/api/bounties?address=${encodeURIComponent(address)}`,
  )
  return body.bounties
}

export async function getBounty(id: string): Promise<Bounty> {
  const body = await request<{ bounty: Bounty }>(`/api/bounties/${id}`)
  return body.bounty
}

export async function postBounty(input: {
  title: string
  brief: string
  rewardMinor: string
  token: Bounty['token']
  deadline: number
  poster: string
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

export async function submitProof(id: string, hunter: string, proof: string): Promise<Bounty> {
  const body = await request<{ bounty: Bounty }>(`/api/bounties/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ hunter, proof }),
  })
  return body.bounty
}

export async function markPaid(id: string, poster: string, txHash: string): Promise<Bounty> {
  const body = await request<{ bounty: Bounty }>(`/api/bounties/${id}/pay`, {
    method: 'POST',
    body: JSON.stringify({ poster, txHash }),
  })
  return body.bounty
}
