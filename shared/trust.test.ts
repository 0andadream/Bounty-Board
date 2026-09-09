import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Bounty } from './types.ts'
import { awaitingPay, DEMO_POSTER, posterPaidLabel, trustForPoster } from './trust.ts'

const now = Date.UTC(2026, 8, 7, 12, 0, 0)

function row(overrides: Partial<Bounty> = {}): Bounty {
  return {
    id: 'LIVEA2',
    title: 'Demo',
    brief: 'Do the thing.',
    rewardMinor: '100000',
    token: 'NIM',
    deadline: now + 86_400_000,
    status: 'open',
    poster: DEMO_POSTER,
    hunter: null,
    proof: null,
    proofNote: null,
    proofImage: null,
    txHash: null,
    createdAt: now,
    claimedAt: null,
    submittedAt: null,
    paidAt: null,
    likes: 1,
    liked: false,
    imageUrl: null,
    ...overrides,
  }
}

test('new poster with only open tickets', () => {
  const trust = trustForPoster([row(), row({ id: 'LIVEB3', rewardMinor: '200000' })], DEMO_POSTER)
  assert.equal(trust.posted, 2)
  assert.equal(trust.paid, 0)
  assert.equal(trust.completed, 0)
  assert.equal(trust.likes, 2)
  assert.equal(posterPaidLabel(trust), 'Posted 2 · no completed bounties yet')
})

test('paid over completed counts unpaid-after-submit', () => {
  const trust = trustForPoster(
    [
      row({ id: 'A', status: 'paid', rewardMinor: '200000' }),
      row({ id: 'B', status: 'submitted', rewardMinor: '100000' }),
      row({ id: 'C', token: 'USDT', status: 'paid', rewardMinor: '1500000' }),
    ],
    DEMO_POSTER,
  )
  assert.equal(trust.paid, 2)
  assert.equal(trust.completed, 3)
  assert.equal(trust.unpaid, 1)
  assert.equal(trust.settledNim, '200000')
  assert.equal(trust.settledUsdt, '1500000')
  assert.equal(posterPaidLabel(trust), 'Poster paid 2/3 completed bounties')
})

test('awaiting pay after 48h unpaid submit', () => {
  assert.equal(awaitingPay(row({ status: 'submitted', submittedAt: now }), now), false)
  assert.equal(
    awaitingPay(row({ status: 'submitted', submittedAt: now - 48 * 60 * 60 * 1000 }), now),
    true,
  )
})
