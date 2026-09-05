import { parseToMinor } from '@shared/money.ts'
import type { Token } from '@shared/types.ts'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner, ErrorNote } from '../components/ui.tsx'
import { useWallet } from '../context/WalletContext.tsx'
import { postBounty } from '../lib/api.ts'
import { toErrorMessage } from '../lib/errors.ts'

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
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const poster = wallet.addressFor(token)

  const hint = useMemo(() => {
    if (token === 'NIM' && !wallet.nimiqAddress) return 'Connect Nimiq Pay to post a NIM bounty.'
    if (token === 'USDT' && !wallet.ethAddress) return 'Connect the EVM wallet to post a USDT bounty.'
    return null
  }, [token, wallet.ethAddress, wallet.nimiqAddress])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      let posterAddress = poster
      if (token === 'USDT' && !posterAddress) {
        posterAddress = await wallet.connectEthereum()
      }
      if (token === 'NIM' && !posterAddress) {
        posterAddress = await wallet.connect()
      }
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
      <p className="m-0 font-mono text-[10px] tracking-[0.28em] uppercase text-paper-2">New ticket</p>
      <h1 className="mt-1 mb-4 text-[28px] text-paper">Post a bounty</h1>
      {hint ? <Banner>{hint}</Banner> : null}

      <form className="paper px-4 py-5" onSubmit={(event) => void onSubmit(event)}>
        <label className="mb-3 block">
          <span className="mb-1 block font-mono text-[10px] tracking-[0.18em] uppercase text-muted">Title</span>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
        </label>
        <label className="mb-3 block">
          <span className="mb-1 block font-mono text-[10px] tracking-[0.18em] uppercase text-muted">Brief</span>
          <textarea
            className="field min-h-[110px]"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            maxLength={500}
            required
          />
        </label>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <label>
            <span className="mb-1 block font-mono text-[10px] tracking-[0.18em] uppercase text-muted">Reward</span>
            <input
              className="field font-mono"
              inputMode="decimal"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              required
            />
          </label>
          <label>
            <span className="mb-1 block font-mono text-[10px] tracking-[0.18em] uppercase text-muted">Token</span>
            <select className="field" value={token} onChange={(e) => setToken(e.target.value as Token)}>
              <option value="NIM">NIM</option>
              <option value="USDT">USDT</option>
            </select>
          </label>
        </div>
        <label className="mb-5 block">
          <span className="mb-1 block font-mono text-[10px] tracking-[0.18em] uppercase text-muted">Deadline</span>
          <input
            className="field"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
          />
        </label>
        <p className="mt-0 mb-4 text-[13px] text-muted">
          No escrow. When the hunter submits proof, you pay them directly from your wallet. The
          receipt is the point.
        </p>
        <button className="btn-accent w-full py-3" type="submit" disabled={busy}>
          {busy ? 'Posting…' : 'Pin to board'}
        </button>
        {error ? <ErrorNote message={error} /> : null}
      </form>
    </main>
  )
}
