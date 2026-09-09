import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  isLikeWallet,
  isValidWallet,
  likeWalletKey,
  normalizeWallet,
  sameAddress,
} from '../shared/address.ts'
import {
  canClaim,
  canPay,
  canSubmit,
  isAccepting,
  isHttpUrl,
  isProofValue,
  listEntries,
  paidCount,
  winnersMax,
} from '../shared/machine.ts'
import { trustMap } from '../shared/trust.ts'
import type {
  BoardStats,
  Bounty,
  BountyEntry,
  BountyListTab,
  BountySort,
  Profile,
  ProofType,
  StoredStatus,
  Token,
} from '../shared/types.ts'
import { maybeSeed } from './seed.ts'

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
  SEED_BOUNTIES?: string
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
  demo?: number | null
  proof_type?: string | null
  winners?: number | null
  entries?: string | null
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
    cover_url TEXT,
    location TEXT,
    skills TEXT,
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
  cover_url?: string | null
  location?: string | null
  skills?: string | null
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
    coverUrl: row.cover_url ?? null,
    location: row.location ?? null,
    skills: row.skills ?? null,
  }
}

function parseOptionalText(input: unknown, label: string, max: number): string | null {
  if (typeof input !== 'string') return null
  const value = input.trim()
  if (!value) return null
  if (value.length > max) throw new Error(`${label} must be ${max} characters or less.`)
  return value
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
    demo: Number(row.demo ?? 0) === 1,
    proofType: parseProofType(row.proof_type),
    winners: Math.max(1, Number(row.winners ?? 1) || 1),
    entries: parseEntryJson(row.entries),
  }
}

function parseEntryJson(raw: string | null | undefined): BountyEntry[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as BountyEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry) => entry && typeof entry.hunter === 'string')
  } catch {
    return []
  }
}

function serializeEntries(entries: BountyEntry[]): string {
  return JSON.stringify(
    entries.map((entry) => ({
      hunter: entry.hunter,
      proof: entry.proof,
      proofNote: entry.proofNote,
      proofImage: entry.proofImage,
      status: entry.status,
      txHash: entry.txHash,
      submittedAt: entry.submittedAt,
      paidAt: entry.paidAt,
    })),
  )
}

function parseWinners(input: unknown): number {
  const n = typeof input === 'number' ? input : Number(input ?? 1)
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    throw new Error('Number of winners must be between 1 and 10.')
  }
  return n
}

function parseProofType(value: string | null | undefined): ProofType {
  if (value === 'text' || value === 'url' || value === 'image') return value
  return 'any'
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
    live: bounties.filter((bounty) => isAccepting(bounty, clock)).length,
    review: bounties.filter((bounty) => listEntries(bounty).some((entry) => entry.status === 'submitted')).length,
    paid: bounties.filter((bounty) => paidCount(bounty) >= winnersMax(bounty)).length,
    likes: totalLikes,
  }
}

async function ensureSchema(db: D1Database): Promise<void> {
  for (const statement of SCHEMA) {
    await db.prepare(statement).run()
  }
  for (const column of [
    'image_url TEXT',
    'proof_note TEXT',
    'proof_image TEXT',
    'demo INTEGER DEFAULT 0',
    'proof_type TEXT',
    'winners INTEGER DEFAULT 1',
    'entries TEXT',
  ]) {
    try {
      await db.prepare(`ALTER TABLE bounties ADD COLUMN ${column}`).run()
    } catch {
      // column already exists
    }
  }
  for (const column of ['cover_url TEXT', 'location TEXT', 'skills TEXT']) {
    try {
      await db.prepare(`ALTER TABLE profiles ADD COLUMN ${column}`).run()
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
    entries: listEntries(bounty).map((entry) => ({
      ...entry,
      hunterProfile: profiles.get(likeWalletKey(entry.hunter)) ?? null,
    })),
  }))
}

async function withProfiles(db: D1Database, bounties: Bounty[]): Promise<Bounty[]> {
  const wallets: string[] = []
  for (const bounty of bounties) {
    wallets.push(bounty.poster)
    if (bounty.hunter) wallets.push(bounty.hunter)
    for (const entry of listEntries(bounty)) wallets.push(entry.hunter)
  }
  return attachProfiles(bounties, await loadProfileMap(db, wallets))
}

async function prepare(env: Env): Promise<void> {
  await ensureSchema(env.DB)
  await maybeSeed(env.DB, env.SEED_BOUNTIES)
}

function attachTrust(bounties: Bounty[], all: Bounty[]): Bounty[] {
  const map = trustMap(all)
  return bounties.map((bounty) => ({
    ...bounty,
    posterTrust: map.get(likeWalletKey(bounty.poster)) ?? bounty.posterTrust,
  }))
}

async function loadAllMapped(db: D1Database): Promise<Bounty[]> {
  const rows = (await db.prepare('SELECT * FROM bounties ORDER BY created_at DESC').all<BountyRow>()).results
  return rows.map(mapBounty)
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
  const all = attachLikes(await loadAllMapped(db), await likeCounts(db), new Set())
  return attachTrust([hydrated], all)[0]
}

app.get('/api/health', (c) => c.json({ ok: true, name: 'Board' }))

app.get('/api/bounties', async (c) => {
  await prepare(c.env)
  const tab = (c.req.query('tab') ?? 'open') as BountyListTab | 'all'
  const address = c.req.query('address')
  const viewerRaw = c.req.query('viewer')
  const sort = (c.req.query('sort') ?? 'new') as BountySort
  let bounties = await loadAllMapped(c.env.DB)
  const clock = now()
  const viewer = viewerRaw && isLikeWallet(viewerRaw) ? likeWalletKey(viewerRaw) : null
  const counts = await likeCounts(c.env.DB)
  const liked = await likedSet(c.env.DB, viewer)
  bounties = attachLikes(bounties, counts, liked)
  const all = bounties
  const stats = computeStats(bounties, clock, [...counts.values()].reduce((sum, n) => sum + n, 0))

  if (address) {
    bounties = bounties.filter(
      (bounty) =>
        sameAddress(bounty.poster, address) ||
        (bounty.hunter && sameAddress(bounty.hunter, address)) ||
        listEntries(bounty).some((entry) => sameAddress(entry.hunter, address)),
    )
  } else if (tab === 'open') {
    bounties = bounties.filter((bounty) => isAccepting(bounty, clock))
  } else if (tab === 'claimed') {
    bounties = bounties.filter(
      (bounty) =>
        listEntries(bounty).some((entry) => entry.status === 'submitted') ||
        (paidCount(bounty) < winnersMax(bounty) && bounty.deadline < clock),
    )
  } else if (tab === 'paid') {
    bounties = bounties.filter((bounty) => paidCount(bounty) >= winnersMax(bounty) || bounty.status === 'paid')
  }

  const sorted = attachTrust(sortBounties(bounties, sort), all)
  return c.json({ bounties: await withProfiles(c.env.DB, sorted), stats })
})

app.get('/api/profiles', async (c) => {
  await prepare(c.env)
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
  await prepare(c.env)
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
  let coverUrl: string | null = null
  try {
    avatarUrl = normalizeImage(body.avatarUrl)
    coverUrl = normalizeImage(body.coverUrl)
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Invalid image.')
  }
  let location: string | null
  let skills: string | null
  try {
    location = parseOptionalText(body.location, 'Location', 80)
    skills = parseOptionalText(body.skills, 'Skills', 80)
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Invalid profile field.')
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
      `UPDATE profiles SET username = ?, username_key = ?, avatar_url = ?, cover_url = ?, location = ?, skills = ?, updated_at = ? WHERE wallet = ?`,
    )
      .bind(username, key, avatarUrl, coverUrl, location, skills, clock, wallet)
      .run()
  } else {
    await c.env.DB.prepare(
      `INSERT INTO profiles (wallet, username, username_key, avatar_url, cover_url, location, skills, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(wallet, username, key, avatarUrl, coverUrl, location, skills, clock, clock)
      .run()
  }

  const row = await c.env.DB.prepare('SELECT * FROM profiles WHERE wallet = ?').bind(wallet).first<ProfileRow>()
  return c.json({ profile: row ? mapProfile(row) : null }, existing ? 200 : 201)
})

app.get('/api/bounties/:id', async (c) => {
  await prepare(c.env)
  const viewerRaw = c.req.query('viewer')
  const viewer = viewerRaw && isLikeWallet(viewerRaw) ? likeWalletKey(viewerRaw) : null
  const bounty = await getBounty(c.env.DB, c.req.param('id').toUpperCase(), viewer)
  if (!bounty) return jsonError('Bounty not found.', 404, 'not_found')
  return c.json({ bounty })
})

app.post('/api/bounties/:id/like', async (c) => {
  await prepare(c.env)
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
  await prepare(c.env)
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
  const proofType = parseProofType(typeof body.proofType === 'string' ? body.proofType : 'any')
  let winners = 1
  try {
    winners = parseWinners(body.winners ?? 1)
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Number of winners must be 1–10.')
  }

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
      created_at, claimed_at, submitted_at, paid_at, image_url, demo, proof_type, winners, entries
    ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, NULL, NULL, NULL, ?, NULL, NULL, NULL, ?, 0, ?, ?, '[]')`,
  )
    .bind(id, title, brief, rewardMinor, token, deadline, poster, createdAt, imageUrl, proofType, winners)
    .run()

  const bounty = await getBounty(c.env.DB, id)
  return c.json({ bounty }, 201)
})

app.post('/api/bounties/:id/boost', async (c) => {
  await prepare(c.env)
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
  await prepare(c.env)
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

  if (winnersMax(bounty) > 1) {
    return c.json({ bounty })
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
  await prepare(c.env)
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
  const required = bounty.proofType ?? 'any'
  if (required === 'url' && !proof) return jsonError('This bounty needs a proof URL.')
  if (required === 'image' && !image) return jsonError('This bounty needs a proof photo.')
  if (required === 'text' && !note) return jsonError('This bounty needs a written note.')

  const hunter = normalizeWallet(bounty.token, hunterRaw)
  const check = canSubmit(bounty, hunter, isProofValue(proofValue) ? proofValue : `https://board.local/entry`)
  if (!check.ok) return jsonError(check.message, check.code === 'already_claimed' ? 409 : 400, check.code)

  const clock = now()
  const entry: BountyEntry = {
    hunter,
    proof: proof || null,
    proofNote: note || null,
    proofImage: image,
    status: 'submitted',
    txHash: null,
    submittedAt: clock,
    paidAt: null,
  }
  const entries = [...listEntries(bounty), entry]
  const first = entries[0]
  const result = await c.env.DB.prepare(
    `UPDATE bounties
     SET hunter = ?, proof = ?, proof_note = ?, proof_image = ?, status = 'submitted', submitted_at = ?,
         claimed_at = COALESCE(claimed_at, ?), entries = ?
     WHERE id = ? AND status != 'paid' AND deadline >= ?`,
  )
    .bind(
      bounty.hunter ?? hunter,
      first.proof,
      first.proofNote,
      first.proofImage,
      clock,
      clock,
      serializeEntries(entries),
      id,
      clock,
    )
    .run()

  if (!result.meta?.changes) {
    return jsonError('Could not submit on this bounty.', 409, 'not_hunter')
  }

  return c.json({ bounty: await getBounty(c.env.DB, id) })
})

app.post('/api/bounties/:id/pay', async (c) => {
  await prepare(c.env)
  const id = c.req.param('id').toUpperCase()
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  const posterRaw = typeof body?.poster === 'string' ? body.poster : ''
  const txHash = typeof body?.txHash === 'string' ? body.txHash.trim() : ''
  const bounty = await getBounty(c.env.DB, id)
  if (!bounty) return jsonError('Bounty not found.', 404, 'not_found')
  const asset = body?.asset === 'USDT' || body?.asset === 'NIM' ? body.asset : bounty.token
  if (asset !== bounty.token) return jsonError('Asset does not match this bounty.')
  if (!txHash) return jsonError('A transaction hash is required before this bounty can be marked paid.')
  if (!isValidWallet(bounty.token, posterRaw)) {
    return jsonError('Poster wallet does not match this bounty token.')
  }

  const poster = normalizeWallet(bounty.token, posterRaw)
  const hunterRawPay = typeof body?.hunter === 'string' ? body.hunter : bounty.hunter
  const check = canPay(bounty, poster, txHash)
  if (!check.ok) return jsonError(check.message, 400, check.code)

  const clock = now()
  const entries = listEntries(bounty)
  const target =
    hunterRawPay && isValidWallet(bounty.token, hunterRawPay)
      ? entries.find((entry) => sameAddress(entry.hunter, hunterRawPay) && entry.status === 'submitted')
      : entries.find((entry) => entry.status === 'submitted')
  if (!target) return jsonError('No submitted entry to pay.', 400, 'no_proof')

  const nextEntries = entries.map((entry) =>
    sameAddress(entry.hunter, target.hunter)
      ? { ...entry, status: 'paid' as const, txHash, paidAt: clock }
      : entry,
  )
  const allPaid = nextEntries.filter((entry) => entry.status === 'paid').length >= winnersMax(bounty)
  const result = await c.env.DB.prepare(
    `UPDATE bounties
     SET status = ?, tx_hash = ?, paid_at = ?, hunter = ?, entries = ?
     WHERE id = ? AND poster = ? AND status != 'paid'`,
  )
    .bind(
      allPaid ? 'paid' : 'submitted',
      txHash,
      clock,
      target.hunter,
      serializeEntries(nextEntries),
      id,
      poster,
    )
    .run()

  if (!result.meta?.changes) {
    return jsonError('Only the poster can mark this bounty paid, after proof is in.', 409, 'not_poster')
  }

  return c.json({ bounty: await getBounty(c.env.DB, id) })
})

export default app
