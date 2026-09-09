import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyClaim, applyPay, applySubmit, canClaim, canPay, canSubmit, openSlots, viewStatus } from './machine.ts'
import type { Bounty } from './types.ts'

const now = Date.UTC(2026, 8, 5, 12, 0, 0)

function bounty(overrides: Partial<Bounty> = {}): Bounty {
  return {
    id: 'B7K2MQ',
    title: 'Write a README',
    brief: 'One page, no fluff.',
    rewardMinor: '100000',
    token: 'NIM',
    deadline: now + 86_400_000,
    status: 'open',
    poster: 'NQ30 A7HU XB26 K9H2 QFHT MB58 A0G1 DEXQ CSG5',
    hunter: null,
    proof: null,
    txHash: null,
    createdAt: now,
    claimedAt: null,
    submittedAt: null,
    paidAt: null,
    ...overrides,
  }
}

const hunter = 'NQ66 UX2A V530 GCN3 T34J RS1V S7M1 KASV AANY'

test('open stays open before deadline', () => {
  assert.equal(viewStatus(bounty(), now), 'open')
})

test('deadline turns unpaid bounties expired without mutating stored status', () => {
  const expired = bounty({ deadline: now - 1 })
  assert.equal(viewStatus(expired, now), 'expired')
  assert.equal(expired.status, 'open')
})

test('paid stays paid after deadline', () => {
  assert.equal(viewStatus(bounty({ status: 'paid', deadline: now - 1 }), now), 'paid')
})

test('claim is first-come, poster cannot claim their own', () => {
  const open = bounty()
  assert.equal(canClaim(open, hunter, now).ok, true)
  assert.equal(canClaim(open, open.poster, now).ok, false)
  const claimed = applyClaim(open, hunter, now)
  assert.equal(claimed.status, 'claimed')
  assert.equal(canClaim(claimed, 'NQ73 106V L6VH J0Y9 141L XMRC 2NJS AJ8S PAB9', now).ok, false)
})

test('expired bounty cannot be claimed — poster reposts', () => {
  const expired = bounty({ deadline: now - 1 })
  assert.equal(canClaim(expired, hunter, now).ok, false)
})

test('only the hunter submits a proof link', () => {
  const claimed = applyClaim(bounty(), hunter, now)
  assert.equal(canSubmit(claimed, claimed.poster, 'https://example.com/proof').ok, false)
  assert.equal(canSubmit(claimed, hunter, 'not-a-url').ok, false)
  const submitted = applySubmit(claimed, hunter, 'https://example.com/proof', now)
  assert.equal(submitted.status, 'submitted')
  assert.equal(submitted.proof, 'https://example.com/proof')
})

test('multiple winner slots stay open until filled', () => {
  const hunter2 = 'NQ73 106V L6VH J0Y9 141L XMRC 2NJS AJ8S PAB9'
  const open = bounty({ winners: 2 })
  const first = applyClaim(open, hunter, now)
  assert.equal(canClaim(first, hunter2, now).ok, true)
  const second = applySubmit(first, hunter, 'https://example.com/one', now)
  assert.equal(canSubmit(second, hunter2, 'https://example.com/two').ok, true)
  const both = applySubmit(second, hunter2, 'https://example.com/two', now)
  assert.equal(both.entries?.length, 2)
  assert.equal(openSlots(both), 0)
})

test('only the poster can mark paid, and only after proof + a tx hash', () => {
  const submitted = applySubmit(applyClaim(bounty(), hunter, now), hunter, 'https://example.com/p', now)
  assert.equal(canPay(submitted, hunter, 'abc').ok, false)
  assert.equal(canPay(submitted, submitted.poster, '').ok, false)
  const paid = applyPay(submitted, submitted.poster, 'deadbeef', now)
  assert.equal(paid.status, 'paid')
  assert.equal(paid.txHash, 'deadbeef')
})
