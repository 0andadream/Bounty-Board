import { sameAddress } from '@shared/address.ts'
import type { Bounty, Profile } from '@shared/types.ts'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BackKey } from '../components/BackKey.tsx'
import { completedCount, earnedLabel, ProfileStage, type ProfileTab } from '../components/ProfileStage.tsx'
import { EmptyTicket, ErrorNote } from '../components/ui.tsx'
import { getProfileByUsername, listMyBounties } from '../lib/api.ts'
import { toErrorMessage } from '../lib/errors.ts'
import { copyText } from '../lib/format.ts'

export function PublicProfile() {
  const { username = '' } = useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posted, setPosted] = useState<Bounty[]>([])
  const [claimed, setClaimed] = useState<Bounty[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<ProfileTab>('details')
  const [shared, setShared] = useState(false)
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
      <main className="screen profile-page">
        <BackKey />
        <EmptyTicket>Loading profile…</EmptyTicket>
      </main>
    )
  }

  if (error || !profile) {
    return (
      <main className="screen profile-page">
        <BackKey />
        <ErrorNote message={error ?? 'Profile not found.'} />
      </main>
    )
  }

  const hunterPaid = claimed.filter((bounty) => bounty.status === 'paid')

  return (
    <main className="screen profile-page">
      <BackKey />
      <ProfileStage
        wallet={profile.wallet}
        username={profile.username}
        avatarUrl={profile.avatarUrl}
        coverUrl={profile.coverUrl}
        location={profile.location}
        skills={profile.skills}
        tab={tab}
        posted={posted}
        claimed={claimed}
        completed={completedCount(hunterPaid)}
        earned={earnedLabel(hunterPaid)}
        now={now}
        shared={shared}
        onTab={setTab}
        onShare={() => {
          void copyText(`${window.location.origin}/u/${profile.username}`).then(() => {
            setShared(true)
            window.setTimeout(() => setShared(false), 1600)
          })
        }}
      />
    </main>
  )
}
