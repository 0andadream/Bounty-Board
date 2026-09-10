import { sameAddress } from '@shared/address.ts'
import type { Bounty } from '@shared/types.ts'
import { useEffect, useState, type FormEvent } from 'react'
import { BackKey } from '../components/BackKey.tsx'
import { completedCount, earnedLabel, ProfileStage, type ProfileTab } from '../components/ProfileStage.tsx'
import { Banner, ErrorNote } from '../components/ui.tsx'
import { useProfile } from '../context/ProfileContext.tsx'
import { useWallet } from '../context/WalletContext.tsx'
import { listMyBounties } from '../lib/api.ts'
import { toErrorMessage } from '../lib/errors.ts'
import { copyText } from '../lib/format.ts'
import { readCoverImage, readProfileImage } from '../lib/image.ts'

export function ProfileScreen() {
  const wallet = useWallet()
  const profile = useProfile()
  const [username, setUsername] = useState(profile.me?.username ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.me?.avatarUrl ?? null)
  const [coverUrl, setCoverUrl] = useState<string | null>(profile.me?.coverUrl ?? null)
  const [location, setLocation] = useState(profile.me?.location ?? '')
  const [skills, setSkills] = useState(profile.me?.skills ?? '')
  const [editing, setEditing] = useState(!profile.me)
  const [tab, setTab] = useState<ProfileTab>('details')
  const [posted, setPosted] = useState<Bounty[]>([])
  const [claimed, setClaimed] = useState<Bounty[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shared, setShared] = useState(false)
  const now = Date.now()
  const walletId = profile.wallet ?? 'board'
  const addresses = [wallet.nimiqAddress, wallet.ethAddress].filter((value): value is string => Boolean(value))

  useEffect(() => {
    if (profile.me) {
      setUsername(profile.me.username)
      setAvatarUrl(profile.me.avatarUrl)
      setCoverUrl(profile.me.coverUrl)
      setLocation(profile.me.location ?? '')
      setSkills(profile.me.skills ?? '')
      setEditing(false)
      return
    }
    if (!profile.ready) return
    if (wallet.status === 'connecting') return
    setUsername('')
    setAvatarUrl(null)
    setCoverUrl(null)
    setLocation('')
    setSkills('')
    setEditing(true)
  }, [profile.me, profile.ready, wallet.status])

  useEffect(() => {
    if (addresses.length === 0) {
      setPosted([])
      setClaimed([])
      return
    }
    let ignore = false
    Promise.all(addresses.map((address) => listMyBounties(address, addresses[0])))
      .then((groups) => {
        if (ignore) return
        const rows = [...new Map(groups.flat().map((bounty) => [bounty.id, bounty])).values()]
        setPosted(rows.filter((bounty) => addresses.some((address) => sameAddress(address, bounty.poster))))
        setClaimed(
          rows.filter(
            (bounty) => bounty.hunter && addresses.some((address) => sameAddress(address, bounty.hunter!)),
          ),
        )
      })
      .catch(() => undefined)
    return () => {
      ignore = true
    }
  }, [wallet.nimiqAddress, wallet.ethAddress])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      if (!profile.wallet) await wallet.connect()
      setBusy(true)
      await profile.save({
        username,
        avatarUrl,
        coverUrl,
        location,
        skills,
      })
      setEditing(false)
      setTab('details')
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function onShare() {
    const handle = (profile.me?.username ?? username).trim()
    if (!handle) {
      setError('Save a username before sharing.')
      return
    }
    const url = `${window.location.origin}/u/${handle}`
    await copyText(url)
    setShared(true)
    window.setTimeout(() => setShared(false), 1600)
  }

  const hunterPaid = claimed.filter((bounty) => bounty.status === 'paid')

  return (
    <main className="screen profile-page">
      <BackKey />
      {!profile.wallet ? (
        <Banner>
          Connect a wallet, then pick a username and photo.{' '}
          <button
            type="button"
            className="underline bg-transparent border-0 p-0 text-inherit"
            onClick={() => void wallet.connect().catch(() => undefined)}
          >
            Connect wallet
          </button>
        </Banner>
      ) : null}
      <ProfileStage
        wallet={walletId}
        username={username}
        avatarUrl={avatarUrl}
        coverUrl={coverUrl}
        location={location}
        skills={skills}
        own
        editing={editing}
        tab={tab}
        posted={posted}
        claimed={claimed}
        completed={completedCount(hunterPaid)}
        earned={earnedLabel(hunterPaid)}
        now={now}
        shared={shared}
        onTab={setTab}
        editLabel={editing ? (profile.me ? 'Close editor' : undefined) : 'Edit Profile'}
        onEdit={() => {
          if (editing && !profile.me) return
          setEditing((value) => !value)
          setTab('details')
        }}
        onShare={() => void onShare()}
        onPickCover={(file) => {
          setError(null)
          void readCoverImage(file)
            .then(setCoverUrl)
            .catch((err) => setError(toErrorMessage(err)))
        }}
        onPickAvatar={(file) => {
          setError(null)
          void readProfileImage(file)
            .then(setAvatarUrl)
            .catch((err) => setError(toErrorMessage(err)))
        }}
        extra={
          editing ? (
            <form className="profile-edit" onSubmit={(event) => void onSubmit(event)}>
              <label>
                <span>Username</span>
                <input
                  className="field"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="hunter"
                  maxLength={20}
                  required
                />
              </label>
              <label>
                <span>Location</span>
                <input
                  className="field"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="City or Remote"
                  maxLength={80}
                />
              </label>
              <label>
                <span>Skills</span>
                <input
                  className="field"
                  value={skills}
                  onChange={(event) => setSkills(event.target.value)}
                  placeholder="Design, video, writing"
                  maxLength={80}
                />
              </label>
              <div className="profile-edit-actions">
                {coverUrl ? (
                  <button type="button" className="btn-ghost" onClick={() => setCoverUrl(null)}>
                    Remove cover
                  </button>
                ) : null}
                {avatarUrl ? (
                  <button type="button" className="btn-ghost" onClick={() => setAvatarUrl(null)}>
                    Remove photo
                  </button>
                ) : null}
                <button className="btn-accent" type="submit" disabled={busy || !profile.wallet}>
                  {busy ? 'Saving…' : profile.me ? 'Save profile' : 'Create profile'}
                </button>
              </div>
              {error ? <ErrorNote message={error} /> : null}
            </form>
          ) : error ? (
            <ErrorNote message={error} />
          ) : null
        }
      />
    </main>
  )
}
