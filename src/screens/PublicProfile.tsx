import { sameAddress } from '@shared/address.ts'
import type { Bounty, Profile } from '@shared/types.ts'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar, BountyCard, EmptyTicket, ErrorNote, FeedHead } from '../components/ui.tsx'
import { getProfileByUsername, listMyBounties } from '../lib/api.ts'
import { toErrorMessage } from '../lib/errors.ts'
import { formatWallet } from '../lib/format.ts'

export function PublicProfile() {
  const { username = '' } = useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posted, setPosted] = useState<Bounty[]>([])
  const [claimed, setClaimed] = useState<Bounty[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const now = Date.now()

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    getProfileByUsername(username)
      .then(async (row) => {
        const work = await listMyBounties(row.wallet)
        if (ignore) return
        setProfile(row)
        setPosted(work.filter((bounty) => sameAddress(bounty.poster, row.wallet)))
        setClaimed(work.filter((bounty) => bounty.hunter && sameAddress(bounty.hunter, row.wallet)))
      })
      .catch((err) => {
        if (!ignore) setError(toErrorMessage(err))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [username])

  if (loading) {
    return (
      <main className="screen">
        <EmptyTicket>Loading profile…</EmptyTicket>
      </main>
    )
  }

  if (error || !profile) {
    return (
      <main className="screen">
        <ErrorNote message={error ?? 'Profile not found.'} />
        <Link to="/" className="mt-4 inline-block text-[13px] text-muted">
          ← Bounties
        </Link>
      </main>
    )
  }

  const token = profile.wallet.startsWith('0x') ? 'USDT' : 'NIM'

  return (
    <main className="screen">
      <Link to="/" className="text-[13px] text-muted no-underline">
        ← Bounties
      </Link>
      <div className="panel mt-4 flex items-center gap-4">
        <Avatar profile={profile} wallet={profile.wallet} size="lg" />
        <div className="min-w-0">
          <h1 className="mt-0 mb-1 text-[28px] tracking-[-0.04em]">{profile.username}</h1>
          <p className="m-0 addr text-muted">{formatWallet(token, profile.wallet)}</p>
        </div>
      </div>

      <h2 className="mt-8 mb-3 text-[20px]">Posted</h2>
      {posted.length === 0 ? (
        <EmptyTicket>No posted bounties.</EmptyTicket>
      ) : (
        <div className="feed mb-8">
          <FeedHead />
          {posted.map((bounty) => (
            <BountyCard key={bounty.id} bounty={bounty} now={now} />
          ))}
        </div>
      )}

      <h2 className="mt-8 mb-3 text-[20px]">Claimed</h2>
      {claimed.length === 0 ? (
        <EmptyTicket>No claimed bounties.</EmptyTicket>
      ) : (
        <div className="feed">
          <FeedHead />
          {claimed.map((bounty) => (
            <BountyCard key={bounty.id} bounty={bounty} now={now} />
          ))}
        </div>
      )}
    </main>
  )
}
