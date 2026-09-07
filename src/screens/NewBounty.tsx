import { parseToMinor } from '@shared/money.ts'
import type { Token } from '@shared/types.ts'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner, ErrorNote } from '../components/ui.tsx'
import { useWallet } from '../context/WalletContext.tsx'
import { postBounty } from '../lib/api.ts'
import { toErrorMessage } from '../lib/errors.ts'
import { readBountyImage } from '../lib/image.ts'

function defaultDeadline(): string {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function NewBounty() {
  const wallet = useWallet()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [reward, setReward] = useState('10')
  const [token, setToken] = useState<Token>('NIM')
  const [deadline, setDeadline] = useState(defaultDeadline)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const poster = wallet.addressFor(token)

  const hint = useMemo(() => {
    if (token === 'NIM' && !wallet.nimiqAddress) {
      return 'Connect a Nimiq wallet to post. Desktop uses Nimiq Hub; Nimiq Pay still works inside the app.'
    }
    if (token === 'USDT' && !wallet.ethAddress) return 'Connect an EVM wallet to post a USDT bounty.'
    return null
  }, [token, wallet.ethAddress, wallet.nimiqAddress])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      let posterAddress = poster
      if (token === 'USDT' && !posterAddress) posterAddress = await wallet.connectEthereum()
      if (token === 'NIM' && !posterAddress) posterAddress = await wallet.connect()
      if (!posterAddress) throw new Error('Connect a wallet to post.')
      const rewardMinor = parseToMinor(reward, token).toString()
      const due = new Date(deadline).getTime()
      setBusy(true)
      const bounty = await postBounty({
        title,
        brief,
        rewardMinor,
        token,
        deadline: due,
        poster: posterAddress,
        imageUrl,
      })
      navigate(`/b/${bounty.id}`)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <p className="m-0 text-[13px] text-muted">New campaign</p>
      <h1 className="mt-1 mb-6 text-[36px] tracking-[-0.05em]">Post a bounty</h1>
      {hint ? <Banner>{hint}</Banner> : null}

      <form className="panel max-w-[640px]" onSubmit={(event) => void onSubmit(event)}>
        <label className="mb-4 block">
          <span className="mb-1 block text-[12px] text-muted">Title</span>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-[12px] text-muted">Brief</span>
          <textarea
            className="field min-h-[120px]"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            maxLength={500}
            required
          />
        </label>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <label>
            <span className="mb-1 block text-[12px] text-muted">Reward</span>
            <input
              className="field font-mono"
              inputMode="decimal"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-[12px] text-muted">Token</span>
            <select className="field" value={token} onChange={(e) => setToken(e.target.value as Token)}>
              <option value="NIM">NIM</option>
              <option value="USDT">USDT</option>
            </select>
          </label>
        </div>
        <label className="mb-4 block">
          <span className="mb-1 block text-[12px] text-muted">Deadline</span>
          <input className="field" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
        </label>
        <div className="mb-5">
          <span className="mb-1 block text-[12px] text-muted">Image</span>
          <div className="flex items-start gap-3">
            <div className="campaign-square" style={{ width: 96, minHeight: 96, borderRadius: 12, background: '#0c0c10' }}>
              {imageUrl ? <img src={imageUrl} alt="" /> : <span className="text-[11px] text-muted not-italic">+</span>}
            </div>
            <div className="flex-1 min-w-0">
              <input
                className="field mb-2"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  void readBountyImage(file)
                    .then(setImageUrl)
                    .catch((err) => setError(toErrorMessage(err)))
                }}
              />
              <input
                className="field"
                placeholder="or paste an image URL"
                onBlur={(event) => {
                  const value = event.target.value.trim()
                  if (value) setImageUrl(value)
                }}
              />
              {imageUrl ? (
                <button
                  type="button"
                  className="btn-ghost mt-2"
                  onClick={() => setImageUrl(null)}
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <p className="mt-0 mb-5 text-[14px] text-muted">
          No escrow. When the hunter submits proof, you pay them directly. The receipt is the point.
        </p>
        <button className="btn-accent" type="submit" disabled={busy}>
          {busy ? 'Posting…' : 'Publish bounty'}
        </button>
        {error ? <ErrorNote message={error} /> : null}
      </form>
    </main>
  )
}
