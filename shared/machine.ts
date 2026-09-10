import { sameAddress } from './address.ts'
import type { Bounty, BountyEntry, MachineResult, StoredStatus, ViewStatus } from './types.ts'

export function entryImages(entry: Pick<BountyEntry, 'proofImage' | 'proofImages'>): string[] {
  if (entry.proofImages && entry.proofImages.length > 0) {
    return entry.proofImages.filter(Boolean)
  }
  return entry.proofImage ? [entry.proofImage] : []
}

export function winnersMax(bounty: Pick<Bounty, 'winners'>): number {
  const n = Number(bounty.winners ?? 1)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(10, Math.floor(n))
}

export function listEntries(bounty: Pick<Bounty, 'entries' | 'hunter' | 'proof' | 'proofNote' | 'proofImage' | 'status' | 'txHash' | 'submittedAt' | 'paidAt' | 'claimedAt'>): BountyEntry[] {
  if (bounty.entries && bounty.entries.length > 0) return bounty.entries
  if (!bounty.hunter) return []
  if (bounty.status === 'open' || bounty.status === 'claimed') return []
  return [
    {
      hunter: bounty.hunter,
      proof: bounty.proof ?? null,
      proofNote: bounty.proofNote ?? null,
      proofImage: bounty.proofImage ?? null,
      proofImages: bounty.proofImage ? [bounty.proofImage] : [],
      status: bounty.status === 'paid' ? 'paid' : 'submitted',
      txHash: bounty.txHash ?? null,
      submittedAt: bounty.submittedAt ?? bounty.claimedAt ?? 0,
      paidAt: bounty.paidAt ?? null,
    },
  ]
}

export function filledSlots(bounty: Parameters<typeof listEntries>[0] & Pick<Bounty, 'winners'>): number {
  return listEntries(bounty).length
}

export function paidCount(bounty: Parameters<typeof listEntries>[0] & Pick<Bounty, 'winners'>): number {
  return listEntries(bounty).filter((entry) => entry.status === 'paid').length
}

export function openSlots(bounty: Parameters<typeof listEntries>[0] & Pick<Bounty, 'winners'>): number {
  return Math.max(0, winnersMax(bounty) - filledSlots(bounty))
}

export function isAccepting(bounty: Pick<Bounty, 'status' | 'deadline' | 'winners' | 'entries' | 'hunter' | 'proof' | 'proofNote' | 'proofImage' | 'txHash' | 'submittedAt' | 'paidAt' | 'claimedAt'>, now: number): boolean {
  if (now > bounty.deadline) return false
  if (paidCount(bounty) >= winnersMax(bounty)) return false
  return openSlots(bounty) > 0
}

export function viewStatus(bounty: Pick<Bounty, 'status' | 'deadline' | 'winners' | 'entries' | 'hunter' | 'proof' | 'proofNote' | 'proofImage' | 'txHash' | 'submittedAt' | 'paidAt' | 'claimedAt'>, now: number): ViewStatus {
  if (bounty.status === 'paid' || paidCount(bounty) >= winnersMax(bounty)) return 'paid'
  if (now > bounty.deadline) return 'expired'
  return bounty.status
}

function fail(code: string, message: string): MachineResult {
  return { ok: false, code, message }
}

const ok: MachineResult = { ok: true }

export function canClaim(
  bounty: Pick<Bounty, 'status' | 'deadline' | 'poster' | 'hunter' | 'winners' | 'entries' | 'proof' | 'proofNote' | 'proofImage' | 'txHash' | 'submittedAt' | 'paidAt' | 'claimedAt'>,
  hunter: string,
  now: number,
): MachineResult {
  if (!hunter) return fail('wallet_disconnected', 'Connect a wallet to claim.')
  if (viewStatus(bounty, now) === 'expired') {
    return fail('expired', 'This bounty expired. The poster can repost it.')
  }
  if (sameAddress(bounty.poster, hunter)) {
    return fail('self_claim', 'You posted this bounty.')
  }
  if (bounty.hunter && sameAddress(bounty.hunter, hunter)) {
    return fail('already_claimed', 'You already have a slot on this bounty.')
  }
  if (listEntries(bounty).some((entry) => sameAddress(entry.hunter, hunter))) {
    return fail('already_claimed', 'You already have a slot on this bounty.')
  }
  if (openSlots(bounty) <= 0) {
    return fail('already_claimed', 'All winner slots are filled.')
  }
  if (winnersMax(bounty) === 1 && (bounty.status !== 'open' || bounty.hunter)) {
    return fail('already_claimed', 'Someone else already claimed this bounty.')
  }
  return ok
}

export function applyClaim(bounty: Bounty, hunter: string, now: number): Bounty {
  const check = canClaim(bounty, hunter, now)
  if (!check.ok) throw new Error(check.message)
  const entries = listEntries(bounty)
  return {
    ...bounty,
    status: winnersMax(bounty) === 1 ? 'claimed' : bounty.status === 'open' ? 'claimed' : bounty.status,
    hunter: bounty.hunter ?? hunter,
    claimedAt: bounty.claimedAt ?? now,
    entries,
  }
}

export function canSubmit(
  bounty: Pick<Bounty, 'status' | 'hunter' | 'poster' | 'winners' | 'entries' | 'proof' | 'proofNote' | 'proofImage' | 'txHash' | 'submittedAt' | 'paidAt' | 'claimedAt'>,
  hunter: string,
  proof: string,
): MachineResult {
  if (!hunter) return fail('wallet_disconnected', 'Connect the hunter wallet to submit proof.')
  if (!isProofValue(proof)) {
    return fail('bad_proof', 'Add a link or a photo of your work.')
  }
  if (bounty.poster && sameAddress(bounty.poster, hunter)) {
    return fail('not_hunter', 'You posted this bounty.')
  }
  const existing = listEntries(bounty).find((entry) => sameAddress(entry.hunter, hunter))
  if (existing) {
    return fail('already_claimed', 'You already submitted on this bounty.')
  }
  if (openSlots(bounty) <= 0) {
    return fail('already_claimed', 'All winner slots are filled.')
  }
  if (winnersMax(bounty) === 1) {
    if (bounty.status !== 'claimed') {
      return fail('bad_state', 'Proof can only be submitted on a claimed bounty.')
    }
    if (!bounty.hunter || !sameAddress(bounty.hunter, hunter)) {
      return fail('not_hunter', 'Only the hunter who claimed this bounty can submit proof.')
    }
  }
  return ok
}

export function applySubmit(bounty: Bounty, hunter: string, proof: string, now: number): Bounty {
  const check = canSubmit(bounty, hunter, proof)
  if (!check.ok) throw new Error(check.message)
  const entry: BountyEntry = {
    hunter,
    proof: proof.trim(),
    proofNote: null,
    proofImage: null,
    proofImages: [],
    status: 'submitted',
    txHash: null,
    submittedAt: now,
    paidAt: null,
  }
  const entries = [...listEntries(bounty), entry]
  return {
    ...bounty,
    status: 'submitted',
    hunter: bounty.hunter ?? hunter,
    proof: proof.trim(),
    submittedAt: now,
    entries,
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

export function isProofValue(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(trimmed)) return true
  const parts = trimmed.split('\n').map((part) => part.trim()).filter(Boolean)
  return parts.length > 0 && parts.every(isHttpUrl)
}

export function nextStoredStatus(from: StoredStatus, event: 'claim' | 'submit' | 'pay'): StoredStatus | null {
  if (event === 'claim' && from === 'open') return 'claimed'
  if (event === 'submit' && from === 'claimed') return 'submitted'
  if (event === 'pay' && from === 'submitted') return 'paid'
  return null
}
