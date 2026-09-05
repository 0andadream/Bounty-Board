import { sameAddress } from './address.ts'
import type { Bounty, MachineResult, StoredStatus, ViewStatus } from './types.ts'

export function viewStatus(bounty: Pick<Bounty, 'status' | 'deadline'>, now: number): ViewStatus {
  if (bounty.status === 'paid') return 'paid'
  if (now > bounty.deadline) return 'expired'
  return bounty.status
}

function fail(code: string, message: string): MachineResult {
  return { ok: false, code, message }
}

const ok: MachineResult = { ok: true }

export function canClaim(
  bounty: Pick<Bounty, 'status' | 'deadline' | 'poster' | 'hunter'>,
  hunter: string,
  now: number,
): MachineResult {
  if (!hunter) return fail('wallet_disconnected', 'Connect a wallet to claim.')
  if (viewStatus(bounty, now) === 'expired') {
    return fail('expired', 'This bounty expired. The poster can repost it.')
  }
  if (bounty.status !== 'open' || bounty.hunter) {
    return fail('already_claimed', 'Someone else already claimed this bounty.')
  }
  if (sameAddress(bounty.poster, hunter)) {
    return fail('self_claim', 'You posted this bounty.')
  }
  return ok
}

export function applyClaim(bounty: Bounty, hunter: string, now: number): Bounty {
  const check = canClaim(bounty, hunter, now)
  if (!check.ok) throw new Error(check.message)
  return {
    ...bounty,
    status: 'claimed',
    hunter,
    claimedAt: now,
  }
}

export function canSubmit(
  bounty: Pick<Bounty, 'status' | 'hunter'>,
  hunter: string,
  proof: string,
): MachineResult {
  if (!hunter) return fail('wallet_disconnected', 'Connect the hunter wallet to submit proof.')
  if (bounty.status !== 'claimed') {
    return fail('bad_state', 'Proof can only be submitted on a claimed bounty.')
  }
  if (!bounty.hunter || !sameAddress(bounty.hunter, hunter)) {
    return fail('not_hunter', 'Only the hunter who claimed this bounty can submit proof.')
  }
  if (!isHttpUrl(proof)) {
    return fail('bad_proof', 'Proof must be an http or https link.')
  }
  return ok
}

export function applySubmit(bounty: Bounty, hunter: string, proof: string, now: number): Bounty {
  const check = canSubmit(bounty, hunter, proof)
  if (!check.ok) throw new Error(check.message)
  return {
    ...bounty,
    status: 'submitted',
    proof: proof.trim(),
    submittedAt: now,
  }
}

export function canPay(
  bounty: Pick<Bounty, 'status' | 'poster' | 'hunter' | 'txHash'>,
  poster: string,
  txHash: string,
): MachineResult {
  if (!poster) return fail('wallet_disconnected', 'Connect the poster wallet to pay.')
  if (!sameAddress(bounty.poster, poster)) {
    return fail('not_poster', 'Only the poster can mark this bounty paid.')
  }
  if (bounty.status === 'paid') {
    return fail('already_paid', 'This bounty is already paid.')
  }
  if (bounty.status !== 'submitted' || !bounty.hunter) {
    return fail('no_proof', 'Wait for the hunter to submit a proof link before paying.')
  }
  if (!txHash.trim()) {
    return fail('no_tx', 'A transaction hash is required. Payment was not recorded.')
  }
  return ok
}

export function applyPay(bounty: Bounty, poster: string, txHash: string, now: number): Bounty {
  const check = canPay(bounty, poster, txHash)
  if (!check.ok) throw new Error(check.message)
  return {
    ...bounty,
    status: 'paid',
    txHash: txHash.trim(),
    paidAt: now,
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function nextStoredStatus(from: StoredStatus, event: 'claim' | 'submit' | 'pay'): StoredStatus | null {
  if (event === 'claim' && from === 'open') return 'claimed'
  if (event === 'submit' && from === 'claimed') return 'submitted'
  if (event === 'pay' && from === 'submitted') return 'paid'
  return null
}
