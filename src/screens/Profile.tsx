import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Banner, ErrorNote } from '../components/ui.tsx'
import { useProfile } from '../context/ProfileContext.tsx'
import { useWallet } from '../context/WalletContext.tsx'
import { toErrorMessage } from '../lib/errors.ts'
import { readProfileImage } from '../lib/image.ts'

export function ProfileScreen() {
  const wallet = useWallet()
  const profile = useProfile()
  const [username, setUsername] = useState(profile.me?.username ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.me?.avatarUrl ?? null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setUsername(profile.me?.username ?? '')
    setAvatarUrl(profile.me?.avatarUrl ?? null)
  }, [profile.me])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaved(false)
    try {
      const walletId = profile.wallet ?? (await wallet.connect())
      if (!walletId) throw new Error('Connect a wallet to set a profile.')
      setBusy(true)
      await profile.save(username, avatarUrl)
      setSaved(true)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="screen screen-profile">
      <div className="profile-wrap">
      <p className="m-0 text-[13px] text-muted">Your handle</p>
      <h1 className="mt-1 mb-6 text-[36px] tracking-[-0.05em]">Profile</h1>
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

      <form className="panel" onSubmit={(event) => void onSubmit(event)}>
        <div className="mb-5 flex items-center gap-4">
          <Avatar
            profile={{ wallet: profile.wallet ?? 'board', username: username || 'yourname', avatarUrl }}
            wallet={profile.wallet ?? 'board'}
            size="lg"
          />
          <div className="min-w-0">
            <p className="m-0 text-[18px] font-semibold">{username || 'yourname'}</p>
            <p className="mt-1 mb-0 text-[12px] text-muted">Shown on bounties you post or claim.</p>
          </div>
        </div>
        <label className="mb-4 block">
          <span className="mb-1 block text-[12px] text-muted">Username</span>
          <input
            className="field"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="hunter"
            maxLength={20}
            required
          />
        </label>
        <div className="mb-5">
          <span className="mb-1 block text-[12px] text-muted">Profile picture</span>
          <input
            className="field mb-2"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              void readProfileImage(file)
                .then(setAvatarUrl)
                .catch((err) => setError(toErrorMessage(err)))
            }}
          />
          <input
            className="field"
            placeholder="or paste an image URL"
            onBlur={(event) => {
              const value = event.target.value.trim()
              if (value) setAvatarUrl(value)
            }}
          />
          {avatarUrl ? (
            <button type="button" className="btn-ghost mt-2" onClick={() => setAvatarUrl(null)}>
              Remove photo
            </button>
          ) : null}
        </div>
        <button className="btn-accent" type="submit" disabled={busy || !profile.wallet}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
        {saved && profile.me ? (
          <p className="mt-3 mb-0 text-[13px] text-muted">
            Saved.{' '}
            <Link to={`/u/${profile.me.username}`} className="text-inherit">
              View public profile
            </Link>
          </p>
        ) : null}
        {error ? <ErrorNote message={error} /> : null}
      </form>
      </div>
    </main>
  )
}
