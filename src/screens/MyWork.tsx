import { viewStatus } from '@shared/machine.ts'
import { sameAddress } from '@shared/address.ts'
import type { Bounty } from '@shared/types.ts'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BackKey } from '../components/BackKey.tsx'
import { Banner, BountyCard, ErrorNote, FeedHead } from '../components/ui.tsx'
import { useWallet } from '../context/WalletContext.tsx'
import { listBounties, listMyBounties, toggleLike } from '../lib/api.ts'
import { toErrorMessage } from '../lib/errors.ts'

type Scope = 'posted' | 'submitted'
type StatusFilter = 'all' | 'open' | 'claimed' | 'paid'

const SCOPES: Array<{ id: Scope; label: string }> = [
  { id: 'posted', label: 'My bounties' },
  { id: 'submitted', label: 'My submissions' },
]

const STATUSES: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'claimed', label: 'In review' },
  { id: 'paid', label: 'Paid' },
]

export function MyWork() {
  const wallet = useWallet()
  const [posted, setPosted] = useState<Bounty[]>([])
  const [claimed, setClaimed] = useState<Bounty[]>([])
  const [liveCount, setLiveCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [scope, setScope] = useState<Scope>('posted')
  const [status, setStatus] = useState<StatusFilter>('all')
  const now = Date.now()
  const addresses = [wallet.nimiqAddress, wallet.ethAddress].filter((value): value is string => Boolean(value))

  useEffect(() => {
    if (addresses.length === 0) {
      setPosted([])
      setClaimed([])
      return
    }
    let ignore = false
    setLoading(true)
    Promise.all([
      Promise.all(addresses.map((address) => listMyBounties(address, addresses[0]))),
      listBounties('open', { sort: 'reward' }),
    ])
      .then(([groups, feed]) => {
        if (ignore) return
        setLiveCount(feed.stats.live)
        const rows = [...new Map(groups.flat().map((bounty) => [bounty.id, bounty])).values()]
        setPosted(rows.filter((bounty) => addresses.some((address) => sameAddress(address, bounty.poster))))
        setClaimed(
          rows.filter(
            (bounty) => bounty.hunter && addresses.some((address) => sameAddress(address, bounty.hunter!)),
          ),
        )
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
  }, [wallet.nimiqAddress, wallet.ethAddress])

  async function onLike(bounty: Bounty) {
    const walletId = addresses[0] ?? (await wallet.connect())
    const next = await toggleLike(bounty.id, walletId)
    setPosted((current) => current.map((row) => (row.id === next.id ? next : row)))
    setClaimed((current) => current.map((row) => (row.id === next.id ? next : row)))
  }

  const source = scope === 'posted' ? posted : claimed
  const rows = useMemo(() => {
    if (status === 'all') return source
    return source.filter((bounty) => {
      const view = viewStatus(bounty, now)
      if (status === 'open') return view === 'open'
      if (status === 'claimed') return view === 'claimed' || view === 'submitted'
      return view === 'paid'
    })
  }, [source, status, now])

  const emptyTitle =
    scope === 'posted' ? "You haven't posted a bounty yet" : "You haven't submitted to a bounty yet"
  const emptyBody =
    scope === 'posted'
      ? 'Create your first bounty to see it in this tab.'
      : 'Submit work on an open bounty to see it here.'

  return (
    <main className="screen mine-page">
      <BackKey />
      <nav className="mine-tabs" aria-label="Board sections">
        <Link to="/bounties" className="mine-tab">
          Bounties <span>{liveCount}</span>
        </Link>
        <button type="button" className={`mine-tab ${scope === 'submitted' ? 'on' : ''}`} onClick={() => setScope('submitted')}>
          Submissions <span>{claimed.length}</span>
        </button>
        <button type="button" className={`mine-tab ${scope === 'posted' ? 'on' : ''}`} onClick={() => setScope('posted')}>
          Mine
        </button>
      </nav>

      <div className="mine-filters">
        <div className="mine-pills">
          {SCOPES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={scope === item.id ? 'on' : ''}
              onClick={() => setScope(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mine-pills">
          {STATUSES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={status === item.id ? 'on' : ''}
              onClick={() => setStatus(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {addresses.length === 0 ? (
        <Banner>
          Connect a wallet to see bounties you posted or claimed.{' '}
          <button
            type="button"
            className="underline bg-transparent border-0 p-0 text-inherit"
            onClick={() => void wallet.connect().catch(() => undefined)}
          >
            Connect wallet
          </button>
        </Banner>
      ) : null}
      {error ? <ErrorNote message={error} /> : null}

      {loading ? (
        <div className="mine-empty">
          <p>Checking the board…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="mine-empty">
          <span className="mine-empty-ico" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
              <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <h2>{emptyTitle}</h2>
          <p>{emptyBody}</p>
          {scope === 'posted' ? (
            <Link to="/bounties?create=1" className="btn-accent no-underline land-create">
              <span aria-hidden="true">+</span> Create
            </Link>
          ) : (
            <Link to="/bounties" className="btn-ghost no-underline">
              Open board
            </Link>
          )}
        </div>
      ) : (
        <div className="feed">
          <FeedHead />
          {rows.map((bounty) => (
            <BountyCard key={bounty.id} bounty={bounty} now={now} onLike={(item) => void onLike(item)} />
          ))}
        </div>
      )}
    </main>
  )
}
