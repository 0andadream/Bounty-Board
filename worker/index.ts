import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { isValidWallet, normalizeWallet, sameAddress } from '../shared/address.ts'
import { canClaim, canPay, canSubmit, isHttpUrl } from '../shared/machine.ts'
import type { Bounty, BountyListTab, StoredStatus, Token } from '../shared/types.ts'

type D1Stmt = {
  bind: (...args: unknown[]) => D1Stmt
  first: <T>() => Promise<T | null>
  all: <T>() => Promise<{ results: T[] }>
  run: () => Promise<{ success: boolean; meta?: { changes?: number } }>
}

type D1Database = {
  prepare: (query: string) => D1Stmt
}

type Env = {
  DB: D1Database
}

type BountyRow = {
  id: string
  title: string
  brief: string
  reward_minor: string
  token: Token
  deadline: number
  status: StoredStatus
  poster: string
  hunter: string | null
  proof: string | null
  tx_hash: string | null
  created_at: number
  claimed_at: number | null
  submitted_at: number | null
  paid_at: number | null
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS bounties (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    brief TEXT NOT NULL,
    reward_minor TEXT NOT NULL,
    token TEXT NOT NULL,
    deadline INTEGER NOT NULL,
    status TEXT NOT NULL,
    poster TEXT NOT NULL,
    hunter TEXT,
    proof TEXT,
    tx_hash TEXT,
    created_at INTEGER NOT NULL,
    claimed_at INTEGER,
    submitted_at INTEGER,
    paid_at INTEGER
  )`,
  'CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_bounties_poster ON bounties(poster)',
  'CREATE INDEX IF NOT EXISTS idx_bounties_hunter ON bounties(hunter)',
]

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const TOKENS: Token[] = ['NIM', 'USDT']

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type'] }))

function now(): number {
  return Date.now()
}

function jsonError(message: string, status = 400, code = 'bad_request') {
  return Response.json({ error: message, code }, { status })
}

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return [...bytes].map((byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('')
}

function mapBounty(row: BountyRow): Bounty {
  return {
    id: row.id,
    title: row.title,
    brief: row.brief,
    rewardMinor: row.reward_minor,
    token: row.token,
    deadline: row.deadline,
    status: row.status,
    poster: row.poster,
    hunter: row.hunter,
    proof: row.proof,
    txHash: row.tx_hash,
    createdAt: row.created_at,
    claimedAt: row.claimed_at,
    submittedAt: row.submitted_at,
    paidAt: row.paid_at,
  }
}

async function ensureSchema(db: D1Database): Promise<void> {
  for (const statement of SCHEMA) {
    await db.prepare(statement).run()
  }
}

async function getBounty(db: D1Database, id: string): Promise<Bounty | null> {
  const row = await db.prepare('SELECT * FROM bounties WHERE id = ?').bind(id).first<BountyRow>()
  return row ? mapBounty(row) : null
}

app.get('/api/health', (c) => c.json({ ok: true, name: 'Board' }))

app.get('/api/bounties', async (c) => {
  await ensureSchema(c.env.DB)
  const tab = (c.req.query('tab') ?? 'open') as BountyListTab | 'all'
  const address = c.req.query('address')
  const rows = (await c.env.DB.prepare('SELECT * FROM bounties ORDER BY created_at DESC').all<BountyRow>()).results
  let bounties = rows.map(mapBounty)
  const clock = now()

  if (address) {
    bounties = bounties.filter(
      (bounty) => sameAddress(bounty.poster, address) || (bounty.hunter && sameAddress(bounty.hunter, address)),
    )
  } else if (tab === 'open') {
    bounties = bounties.filter((bounty) => bounty.status === 'open' && bounty.deadline >= clock)
  } else if (tab === 'claimed') {
    bounties = bounties.filter(
      (bounty) =>
        bounty.status === 'claimed' ||
        bounty.status === 'submitted' ||
        (bounty.status !== 'paid' && bounty.deadline < clock),
    )
  } else if (tab === 'paid') {
    bounties = bounties.filter((bounty) => bounty.status === 'paid')
  }

  return c.json({ bounties })
})

app.get('/api/bounties/:id', async (c) => {
  await ensureSchema(c.env.DB)
  const bounty = await getBounty(c.env.DB, c.req.param('id').toUpperCase())
  if (!bounty) return jsonError('Bounty not found.', 404, 'not_found')
  return c.json({ bounty })
})

app.post('/api/bounties', async (c) => {
  await ensureSchema(c.env.DB)
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return jsonError('Invalid JSON.')

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const brief = typeof body.brief === 'string' ? body.brief.trim() : ''
  const token = body.token === 'USDT' ? 'USDT' : body.token === 'NIM' ? 'NIM' : null
  const posterRaw = typeof body.poster === 'string' ? body.poster : ''
  const rewardMinor = typeof body.rewardMinor === 'string' ? body.rewardMinor : ''
  const deadline = typeof body.deadline === 'number' ? body.deadline : Number(body.deadline)

  if (title.length < 3 || title.length > 80) return jsonError('Title must be 3–80 characters.')
  if (brief.length < 8 || brief.length > 500) return jsonError('Brief must be 8–500 characters.')
  if (!token || !TOKENS.includes(token)) return jsonError('Token must be NIM or USDT.')
  if (!isValidWallet(token, posterRaw)) return jsonError('Poster wallet does not match the selected token.')
  if (!/^\d+$/.test(rewardMinor) || BigInt(rewardMinor) <= 0n) return jsonError('Reward must be a positive amount.')
  if (!Number.isFinite(deadline) || deadline <= now()) return jsonError('Deadline must be in the future.')

  const poster = normalizeWallet(token, posterRaw)
  let id = randomId()
  for (let i = 0; i < 5; i += 1) {
    const existing = await getBounty(c.env.DB, id)
    if (!existing) break
    id = randomId()
  }

  const createdAt = now()
  await c.env.DB.prepare(
    `INSERT INTO bounties (
      id, title, brief, reward_minor, token, deadline, status, poster, hunter, proof, tx_hash,
      created_at, claimed_at, submitted_at, paid_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, NULL, NULL, NULL, ?, NULL, NULL, NULL)`,
  )
    .bind(id, title, brief, rewardMinor, token, deadline, poster, createdAt)
    .run()

  const bounty = await getBounty(c.env.DB, id)
  return c.json({ bounty }, 201)
})

app.post('/api/bounties/:id/claim', async (c) => {
  await ensureSchema(c.env.DB)
  const id = c.req.param('id').toUpperCase()
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  const hunterRaw = typeof body?.hunter === 'string' ? body.hunter : ''
  const bounty = await getBounty(c.env.DB, id)
  if (!bounty) return jsonError('Bounty not found.', 404, 'not_found')
  if (!isValidWallet(bounty.token, hunterRaw)) {
    return jsonError('Hunter wallet does not match this bounty token.')
  }

  const hunter = normalizeWallet(bounty.token, hunterRaw)
  const clock = now()
  const check = canClaim(bounty, hunter, clock)
  if (!check.ok) {
    return jsonError(check.message, check.code === 'already_claimed' ? 409 : 400, check.code)
  }

  const result = await c.env.DB.prepare(
    `UPDATE bounties
     SET hunter = ?, status = 'claimed', claimed_at = ?
     WHERE id = ? AND status = 'open' AND hunter IS NULL AND deadline >= ?`,
  )
    .bind(hunter, clock, id, clock)
    .run()

  if (!result.meta?.changes) {
    return jsonError('Someone else already claimed this bounty.', 409, 'already_claimed')
  }

  return c.json({ bounty: await getBounty(c.env.DB, id) })
})

app.post('/api/bounties/:id/submit', async (c) => {
  await ensureSchema(c.env.DB)
  const id = c.req.param('id').toUpperCase()
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  const hunterRaw = typeof body?.hunter === 'string' ? body.hunter : ''
  const proof = typeof body?.proof === 'string' ? body.proof.trim() : ''
  const bounty = await getBounty(c.env.DB, id)
  if (!bounty) return jsonError('Bounty not found.', 404, 'not_found')
  if (!isValidWallet(bounty.token, hunterRaw)) {
    return jsonError('Hunter wallet does not match this bounty token.')
  }

  const hunter = normalizeWallet(bounty.token, hunterRaw)
  const check = canSubmit(bounty, hunter, proof)
  if (!check.ok) return jsonError(check.message, 400, check.code)
  if (!isHttpUrl(proof)) return jsonError('Proof must be an http or https link.', 400, 'bad_proof')

  const clock = now()
  const result = await c.env.DB.prepare(
    `UPDATE bounties
     SET proof = ?, status = 'submitted', submitted_at = ?
     WHERE id = ? AND status = 'claimed' AND hunter = ?`,
  )
    .bind(proof, clock, id, hunter)
    .run()

  if (!result.meta?.changes) {
    return jsonError('Only the hunter who claimed this bounty can submit proof.', 409, 'not_hunter')
  }

  return c.json({ bounty: await getBounty(c.env.DB, id) })
})

app.post('/api/bounties/:id/pay', async (c) => {
  await ensureSchema(c.env.DB)
  const id = c.req.param('id').toUpperCase()
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  const posterRaw = typeof body?.poster === 'string' ? body.poster : ''
  const txHash = typeof body?.txHash === 'string' ? body.txHash.trim() : ''
  const bounty = await getBounty(c.env.DB, id)
  if (!bounty) return jsonError('Bounty not found.', 404, 'not_found')
  if (!isValidWallet(bounty.token, posterRaw)) {
    return jsonError('Poster wallet does not match this bounty token.')
  }

  const poster = normalizeWallet(bounty.token, posterRaw)
  const check = canPay(bounty, poster, txHash)
  if (!check.ok) return jsonError(check.message, 400, check.code)

  const clock = now()
  const result = await c.env.DB.prepare(
    `UPDATE bounties
     SET status = 'paid', tx_hash = ?, paid_at = ?
     WHERE id = ? AND status = 'submitted' AND poster = ? AND hunter IS NOT NULL`,
  )
    .bind(txHash, clock, id, poster)
    .run()

  if (!result.meta?.changes) {
    return jsonError('Only the poster can mark this bounty paid, after proof is in.', 409, 'not_poster')
  }

  return c.json({ bounty: await getBounty(c.env.DB, id) })
})

export default app
