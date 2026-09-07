import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  isLikeWallet,
  isValidWallet,
  likeWalletKey,
  normalizeWallet,
  sameAddress,
} from '../shared/address.ts'
import { canClaim, canPay, canSubmit, isHttpUrl, isProofValue } from '../shared/machine.ts'
import type { BoardStats, Bounty, BountyListTab, BountySort, Profile, StoredStatus, Token } from '../shared/types.ts'

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
  likes?: number
  image_url?: string | null
  proof_note?: string | null
  proof_image?: string | null
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
    paid_at INTEGER,
    image_url TEXT,
    proof_note TEXT,
    proof_image TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_bounties_poster ON bounties(poster)',
  'CREATE INDEX IF NOT EXISTS idx_bounties_hunter ON bounties(hunter)',
  `CREATE TABLE IF NOT EXISTS likes (
    bounty_id TEXT NOT NULL,
    wallet TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (bounty_id, wallet)
  )`,
  'CREATE INDEX IF NOT EXISTS idx_likes_bounty ON likes(bounty_id)',
  `CREATE TABLE IF NOT EXISTS profiles (
    wallet TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    username_key TEXT NOT NULL UNIQUE,
    avatar_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username_key)',
]

type ProfileRow = {
  wallet: string
  username: string
  username_key: string
  avatar_url: string | null
  created_at: number
  updated_at: number
}

const RESERVED_NAMES = new Set([
  'board',
  'profile',
  'profiles',
  'new',
  'mine',
  'probe',
  'bounties',
  'bounty',
  'api',
  'admin',
  'u',
  'me',
  'settings',
  'post',
])

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

function mapProfile(row: ProfileRow): Profile {
  return {
    wallet: row.wallet,
    username: row.username,
    avatarUrl: row.avatar_url ?? null,
  }
}

function parseUsername(input: unknown): { username: string; key: string } {
  if (typeof input !== 'string') throw new Error('Pick a username.')
  const username = input.trim()
  if (!/^[a-zA-Z][a-zA-Z0-9_]{2,19}$/.test(username)) {
    throw new Error('Username must be 3–20 characters, start with a letter, and use only letters, numbers, or _.')
  }
  const key = username.toLowerCase()
  if (RESERVED_NAMES.has(key)) throw new Error('That username is reserved.')
  return { username, key }
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
    likes: Number(row.likes ?? 0),
    liked: false,
    imageUrl: row.image_url ?? null,
    proofNote: row.proof_note ?? null,
    proofImage: row.proof_image ?? null,
  }
}

function normalizeImage(input: unknown): string | null {
  if (typeof input !== 'string' || !input.trim()) return null
  const value = input.trim()
  if (/^https?:\/\//i.test(value) && value.length <= 2000) return value
  if (/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value) && value.length <= 280_000) return value
  throw new Error('Image must be a link or a small uploaded photo.')
}

function sortBounties(bounties: Bounty[], sort: BountySort): Bounty[] {
  const copy = [...bounties]
  if (sort === 'reward') {
    copy.sort((a, b) => Number(BigInt(b.rewardMinor) - BigInt(a.rewardMinor)))
  } else if (sort === 'ending') {
    copy.sort((a, b) => a.deadline - b.deadline)
  } else {
    copy.sort((a, b) => b.createdAt - a.createdAt)
  }
  return copy
}

async function likeCounts(db: D1Database): Promise<Map<string, number>> {
  const rows = (await db.prepare('SELECT bounty_id, COUNT(*) as cnt FROM likes GROUP BY bounty_id').all<{
    bounty_id: string
    cnt: number
  }>()).results
  return new Map(rows.map((row) => [row.bounty_id, Number(row.cnt)]))
}

async function likedSet(db: D1Database, wallet: string | null): Promise<Set<string>> {
  if (!wallet) return new Set()
  const rows = (
    await db.prepare('SELECT bounty_id FROM likes WHERE wallet = ?').bind(wallet).all<{ bounty_id: string }>()
  ).results
  return new Set(rows.map((row) => row.bounty_id))
}

function attachLikes(bounties: Bounty[], counts: Map<string, number>, liked: Set<string>): Bounty[] {
  return bounties.map((bounty) => ({
    ...bounty,
    likes: counts.get(bounty.id) ?? 0,
    liked: liked.has(bounty.id),
  }))
}

function computeStats(bounties: Bounty[], clock: number, totalLikes: number): BoardStats {
  return {
    live: bounties.filter((bounty) => bounty.status === 'open' && bounty.deadline >= clock).length,
    review: bounties.filter(
      (bounty) => bounty.status === 'claimed' || bounty.status === 'submitted',
    ).length,
    paid: bounties.filter((bounty) => bounty.status === 'paid').length,
    likes: totalLikes,
  }
}

async function ensureSchema(db: D1Database): Promise<void> {
  for (const statement of SCHEMA) {
    await db.prepare(statement).run()
  }
  for (const column of ['image_url TEXT', 'proof_note TEXT', 'proof_image TEXT']) {
    try {
      await db.prepare(`ALTER TABLE bounties ADD COLUMN ${column}`).run()
    } catch {
      // column already exists
    }
  }
}

async function loadProfileMap(db: D1Database, wallets: string[]): Promise<Map<string, Profile>> {
  const keys = [...new Set(wallets.filter(Boolean).map((wallet) => likeWalletKey(wallet)))]
  if (keys.length === 0) return new Map()
  const map = new Map<string, Profile>()
  const chunk = 40
  for (let i = 0; i < keys.length; i += chunk) {
    const slice = keys.slice(i, i + chunk)
    const placeholders = slice.map(() => '?').join(',')
    const rows = (
      await db.prepare(`SELECT * FROM profiles WHERE wallet IN (${placeholders})`).bind(...slice).all<ProfileRow>()
    ).results
    for (const row of rows) map.set(row.wallet, mapProfile(row))
  }
  return map
}

function attachProfiles(bounties: Bounty[], profiles: Map<string, Profile>): Bounty[] {
  return bounties.map((bounty) => ({
    ...bounty,
    posterProfile: profiles.get(likeWalletKey(bounty.poster)) ?? null,
    hunterProfile: bounty.hunter ? (profiles.get(likeWalletKey(bounty.hunter)) ?? null) : null,
  }))
}

async function withProfiles(db: D1Database, bounties: Bounty[]): Promise<Bounty[]> {
  const wallets: string[] = []
  for (const bounty of bounties) {
    wallets.push(bounty.poster)
    if (bounty.hunter) wallets.push(bounty.hunter)
  }
  return attachProfiles(bounties, await loadProfileMap(db, wallets))
}

async function getBounty(db: D1Database, id: string, viewer?: string | null): Promise<Bounty | null> {
  const row = await db.prepare('SELECT * FROM bounties WHERE id = ?').bind(id).first<BountyRow>()
  if (!row) return null
  const bounty = mapBounty(row)
  const count = await db.prepare('SELECT COUNT(*) as cnt FROM likes WHERE bounty_id = ?').bind(id).first<{ cnt: number }>()
  bounty.likes = Number(count?.cnt ?? 0)
  if (viewer) {
    const hit = await db.prepare('SELECT bounty_id FROM likes WHERE bounty_id = ? AND wallet = ?').bind(id, viewer).first()
    bounty.liked = Boolean(hit)
  }
  const [hydrated] = await withProfiles(db, [bounty])
  return hydrated
}

app.get('/api/health', (c) => c.json({ ok: true, name: 'Board' }))

app.get('/api/bounties', async (c) => {
  await ensureSchema(c.env.DB)
  const tab = (c.req.query('tab') ?? 'open') as BountyListTab | 'all'
  const address = c.req.query('address')
  const viewerRaw = c.req.query('viewer')
  const sort = (c.req.query('sort') ?? 'new') as BountySort
  const rows = (await c.env.DB.prepare('SELECT * FROM bounties ORDER BY created_at DESC').all<BountyRow>()).results
  let bounties = rows.map(mapBounty)
  const clock = now()
  const viewer = viewerRaw && isLikeWallet(viewerRaw) ? likeWalletKey(viewerRaw) : null
  const counts = await likeCounts(c.env.DB)
  const liked = await likedSet(c.env.DB, viewer)
  bounties = attachLikes(bounties, counts, liked)
  const stats = computeStats(bounties, clock, [...counts.values()].reduce((sum, n) => sum + n, 0))

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

  const sorted = sortBounties(bounties, sort)
  return c.json({ bounties: await withProfiles(c.env.DB, sorted), stats })
})

app.get('/api/profiles', async (c) => {
  await ensureSchema(c.env.DB)
  const username = c.req.query('username')
  const walletRaw = c.req.query('wallet')
  const walletsRaw = c.req.query('wallets')

  if (username) {
    const key = username.trim().toLowerCase()
    const row = await c.env.DB.prepare('SELECT * FROM profiles WHERE username_key = ?').bind(key).first<ProfileRow>()
    if (!row) return jsonError('Profile not found.', 404, 'not_found')
    return c.json({ profile: mapProfile(row) })
  }

  if (walletRaw) {
    if (!isLikeWallet(walletRaw)) return jsonError('Connect a wallet first.')
    const row = await c.env.DB.prepare('SELECT * FROM profiles WHERE wallet = ?')
      .bind(likeWalletKey(walletRaw))
      .first<ProfileRow>()
    return c.json({ profile: row ? mapProfile(row) : null })
  }

  const wallets = (walletsRaw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 80)
  const map = await loadProfileMap(c.env.DB, wallets)
  return c.json({ profiles: [...map.values()] })
})

app.post('/api/profiles', async (c) => {
  await ensureSchema(c.env.DB)
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return jsonError('Invalid JSON.')
  const walletRaw = typeof body.wallet === 'string' ? body.wallet : ''
  if (!isLikeWallet(walletRaw)) return jsonError('Connect a wallet to set a profile.')
  let username: string
  let key: string
  try {
    const parsed = parseUsername(body.username)
    username = parsed.username
    key = parsed.key
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Invalid username.')
  }
  let avatarUrl: string | null = null
  try {
    avatarUrl = normalizeImage(body.avatarUrl)
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Invalid image.')
  }

  const wallet = likeWalletKey(walletRaw)
  const taken = await c.env.DB.prepare('SELECT wallet FROM profiles WHERE username_key = ?').bind(key).first<{
    wallet: string
  }>()
  if (taken && taken.wallet !== wallet) return jsonError('That username is taken.', 409, 'username_taken')

  const clock = now()
  const existing = await c.env.DB.prepare('SELECT wallet FROM profiles WHERE wallet = ?').bind(wallet).first()
  if (existing) {
    await c.env.DB.prepare(
      'UPDATE profiles SET username = ?, username_key = ?, avatar_url = ?, updated_at = ? WHERE wallet = ?',
    )
      .bind(username, key, avatarUrl, clock, wallet)
      .run()
  } else {
    await c.env.DB.prepare(
      'INSERT INTO profiles (wallet, username, username_key, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(wallet, username, key, avatarUrl, clock, clock)
      .run()
  }

  const row = await c.env.DB.prepare('SELECT * FROM profiles WHERE wallet = ?').bind(wallet).first<ProfileRow>()
  return c.json({ profile: row ? mapProfile(row) : null }, existing ? 200 : 201)
})

app.get('/api/bounties/:id', async (c) => {
  await ensureSchema(c.env.DB)
  const viewerRaw = c.req.query('viewer')
  const viewer = viewerRaw && isLikeWallet(viewerRaw) ? likeWalletKey(viewerRaw) : null
  const bounty = await getBounty(c.env.DB, c.req.param('id').toUpperCase(), viewer)
  if (!bounty) return jsonError('Bounty not found.', 404, 'not_found')
  return c.json({ bounty })
})

app.post('/api/bounties/:id/like', async (c) => {
  await ensureSchema(c.env.DB)
  const id = c.req.param('id').toUpperCase()
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  const walletRaw = typeof body?.wallet === 'string' ? body.wallet : ''
  if (!isLikeWallet(walletRaw)) return jsonError('Connect a wallet to like a bounty.')
  const bounty = await getBounty(c.env.DB, id)
  if (!bounty) return jsonError('Bounty not found.', 404, 'not_found')

  const wallet = likeWalletKey(walletRaw)
  const existing = await c.env.DB.prepare('SELECT wallet FROM likes WHERE bounty_id = ? AND wallet = ?')
    .bind(id, wallet)
    .first()

  if (existing) {
    await c.env.DB.prepare('DELETE FROM likes WHERE bounty_id = ? AND wallet = ?').bind(id, wallet).run()
  } else {
    await c.env.DB.prepare('INSERT INTO likes (bounty_id, wallet, created_at) VALUES (?, ?, ?)')
      .bind(id, wallet, now())
      .run()
  }

  const next = await getBounty(c.env.DB, id, wallet)
  return c.json({ bounty: next, liked: !existing })
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
  let imageUrl: string | null = null
  try {
    imageUrl = normalizeImage(body.imageUrl)
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Invalid image.')
  }

  if (title.length < 3 || title.length > 80) return jsonError('Title must be 3–80 characters.')
  if (brief.length < 8 || brief.length > 2000) return jsonError('Brief must be 8–2000 characters.')
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
      created_at, claimed_at, submitted_at, paid_at, image_url
    ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, NULL, NULL, NULL, ?, NULL, NULL, NULL, ?)`,
  )
    .bind(id, title, brief, rewardMinor, token, deadline, poster, createdAt, imageUrl)
    .run()

  const bounty = await getBounty(c.env.DB, id)
  return c.json({ bounty }, 201)
})

app.post('/api/bounties/:id/boost', async (c) => {
  await ensureSchema(c.env.DB)
  const id = c.req.param('id').toUpperCase()
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  const walletRaw = typeof body?.wallet === 'string' ? body.wallet : ''
  const amountMinor = typeof body?.amountMinor === 'string' ? body.amountMinor : ''
  const bounty = await getBounty(c.env.DB, id)
  if (!bounty) return jsonError('Bounty not found.', 404, 'not_found')
  if (bounty.status === 'paid') return jsonError('This bounty is already paid.')
  if (bounty.deadline < now()) return jsonError('This bounty has ended.')
  if (!isValidWallet(bounty.token, walletRaw)) {
    return jsonError('Wallet does not match this bounty token.')
  }
  if (!/^\d+$/.test(amountMinor) || BigInt(amountMinor) <= 0n) {
    return jsonError('Enter a positive amount to add.')
  }

  const nextReward = (BigInt(bounty.rewardMinor) + BigInt(amountMinor)).toString()
  const result = await c.env.DB.prepare(
    `UPDATE bounties SET reward_minor = ? WHERE id = ? AND status != 'paid' AND deadline >= ?`,
  )
    .bind(nextReward, id, now())
    .run()

  if (!result.meta?.changes) return jsonError('Could not add to this pool.')
  return c.json({ bounty: await getBounty(c.env.DB, id) })
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
  const proofRaw = typeof body?.proof === 'string' ? body.proof.trim() : ''
  const note = typeof body?.note === 'string' ? body.note.trim() : ''
  let image: string | null = null
  try {
    image = normalizeImage(body?.image)
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Invalid image.')
  }
  const bounty = await getBounty(c.env.DB, id)
  if (!bounty) return jsonError('Bounty not found.', 404, 'not_found')
  if (!isValidWallet(bounty.token, hunterRaw)) {
    return jsonError('Hunter wallet does not match this bounty token.')
  }
  if (note.length > 500) return jsonError('Keep your note under 500 characters.')
  const links = proofRaw
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean)
  if (links.some((link) => !isHttpUrl(link))) return jsonError('Entry links must be http or https.')
  const proof = links.join('\n')
  const proofValue = proof || image || ''
  if (!proofValue && !note) return jsonError('Add a link, photo, or note so the poster can review your work.')

  const hunter = normalizeWallet(bounty.token, hunterRaw)
  const check = canSubmit(bounty, hunter, isProofValue(proofValue) ? proofValue : `https://board.local/entry`)
  if (!check.ok) return jsonError(check.message, 400, check.code)

  const clock = now()
  const result = await c.env.DB.prepare(
    `UPDATE bounties
     SET proof = ?, proof_note = ?, proof_image = ?, status = 'submitted', submitted_at = ?
     WHERE id = ? AND status = 'claimed' AND hunter = ?`,
  )
    .bind(proof || null, note || null, image, clock, id, hunter)
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
