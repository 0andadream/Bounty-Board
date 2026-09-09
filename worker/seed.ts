import { formatNimiqAddress, likeWalletKey } from '../shared/address.ts'
import { parseToMinor } from '../shared/money.ts'
import { DEMO_POSTER } from '../shared/trust.ts'
import type { ProofType } from '../shared/types.ts'

type D1Stmt = {
  bind: (...args: unknown[]) => D1Stmt
  first: <T>() => Promise<T | null>
  all: <T>() => Promise<{ results: T[] }>
  run: () => Promise<{ success: boolean; meta?: { changes?: number } }>
}

type D1Database = {
  prepare: (query: string) => D1Stmt
}

const DAY = 86_400_000

const SEEDS: Array<{
  id: string
  title: string
  brief: string
  nim: string
  proofType: ProofType
}> = [
  {
    id: 'LIVEA2',
    title: 'Screenshot this Mini App and drop the URL',
    brief: [
      'Open Bounty Board in Nimiq Pay, screenshot the board, and paste a public image URL.',
      'One screenshot of the live board.',
      'A public https link to that image.',
    ].join('\n'),
    nim: '2',
    proofType: 'url',
  },
  {
    id: 'LIVEB3',
    title: 'Write a 1-line review of Bounty Board',
    brief: [
      'One honest line about using Board: what clicked, what was missing.',
      'A single sentence, no essay.',
    ].join('\n'),
    nim: '1',
    proofType: 'text',
  },
  {
    id: 'LIVEC4',
    title: 'Follow / reply on X with a screenshot',
    brief: [
      'Post or reply on X with a screenshot of Board and drop the post URL.',
      'Public X post or reply URL.',
    ].join('\n'),
    nim: '3',
    proofType: 'url',
  },
  {
    id: 'LIVED5',
    title: 'Record 15s of the claim flow',
    brief: [
      'Screen-record about 15 seconds of opening a bounty and tapping Submit work. Upload and send the link.',
      'Public https link to the recording.',
    ].join('\n'),
    nim: '5',
    proofType: 'url',
  },
  {
    id: 'LIVEE6',
    title: 'Suggest one bounty idea in a comment',
    brief: [
      'One bounty you would actually post on Board. Title plus who would hunt it.',
      'A short written suggestion.',
    ].join('\n'),
    nim: '1',
    proofType: 'text',
  },
]

export async function maybeSeed(db: D1Database, seedFlag?: string): Promise<void> {
  if (seedFlag === 'false') return
  const row = await db.prepare('SELECT COUNT(*) as cnt FROM bounties').first<{ cnt: number }>()
  if (Number(row?.cnt ?? 0) > 0) return

  const poster = formatNimiqAddress(DEMO_POSTER)
  const createdAt = Date.now()
  const deadline = createdAt + 14 * DAY
  const walletKey = likeWalletKey(poster)

  await db
    .prepare(
      `INSERT OR IGNORE INTO profiles (
        wallet, username, username_key, avatar_url, cover_url, location, skills, created_at, updated_at
      ) VALUES (?, 'boarddemo', 'boarddemo', NULL, NULL, 'Nimiq Pay', 'specs, receipts, NIM', ?, ?)`,
    )
    .bind(walletKey, createdAt, createdAt)
    .run()

  for (const seed of SEEDS) {
    const reward = parseToMinor(seed.nim, 'NIM').toString()
    await db
      .prepare(
        `INSERT OR IGNORE INTO bounties (
          id, title, brief, reward_minor, token, deadline, status, poster, hunter, proof, tx_hash,
          created_at, claimed_at, submitted_at, paid_at, image_url, proof_note, proof_image, demo, proof_type
        ) VALUES (?, ?, ?, ?, 'NIM', ?, 'open', ?, NULL, NULL, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, 1, ?)`,
      )
      .bind(seed.id, seed.title, seed.brief, reward, deadline, poster, createdAt, seed.proofType)
      .run()
  }
}
