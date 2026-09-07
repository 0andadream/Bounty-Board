import type { BoardStats, Bounty, BountyListTab, BountySort } from '@shared/types.ts'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PostBountyModal } from '../components/PostBountyModal.tsx'
import { SideRail } from '../components/SideRail.tsx'
import { BountyCard, EmptyTicket, ErrorNote, FeedHead } from '../components/ui.tsx'
import { useWallet } from '../context/WalletContext.tsx'
import { listAllBounties, listBounties, toggleLike } from '../lib/api.ts'
import { toErrorMessage } from '../lib/errors.ts'

const TABS: Array<{ id: BountyListTab; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'claimed', label: 'In review' },
  { id: 'paid', label: 'Paid' },
]

const SORTS: Array<{ id: BountySort; label: string }> = [
  { id: 'reward', label: 'Highest reward' },
  { id: 'new', label: 'Newest' },
  { id: 'ending', label: 'Ending soon' },
]

const EMPTY_STATS: BoardStats = { live: 0, review: 0, paid: 0, likes: 0 }

export function BoardScreen() {
  const wallet = useWallet()
  const [params, setParams] = useSearchParams()
  const createOpen = params.get('create') === '1'
  const viewer = wallet.nimiqAddress ?? wallet.ethAddress
  const [tab, setTab] = useState<BountyListTab>('open')
  const [sort, setSort] = useState<BountySort>('reward')
  const [bounties, setBounties] = useState<Bounty[]>([])
  const [tape, setTape] = useState<Bounty[]>([])
  const [stats, setStats] = useState<BoardStats>(EMPTY_STATS)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const now = Date.now()

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    Promise.all([listBounties(tab, { sort, viewer }), listAllBounties(viewer)])
      .then(([feed, all]) => {
        if (ignore) return
        setBounties(feed.bounties)
        setStats(feed.stats)
        setTape(all)
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
  }, [tab, sort, viewer, reload])

  async function onLike(bounty: Bounty) {
    try {
      const walletId = wallet.nimiqAddress ?? wallet.ethAddress ?? (await wallet.connect())
      const next = await toggleLike(bounty.id, walletId)
      setBounties((current) => current.map((row) => (row.id === next.id ? next : row)))
      setTape((current) => current.map((row) => (row.id === next.id ? next : row)))
      setStats((current) => ({
        ...current,
        likes: current.likes + (next.liked ? 1 : -1),
      }))
    } catch (err) {
      setError(toErrorMessage(err))
    }
  }

  return (
    <main className="board-page">
      <div className="board-main">
      <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="mt-0 mb-1 text-[34px] tracking-[-0.05em]">Bounties</h1>
          <p className="m-0 text-[14px] text-muted">Search and filter open bounties</p>
        </div>
      </div>

      <div className="stats">
        <div>
          <strong>{stats.live}</strong>
          live
        </div>
        <div>
          <strong>{stats.review}</strong>
          in review
        </div>
        <div>
          <strong>{stats.paid}</strong>
          paid out
        </div>
        <div>
          <strong>{stats.likes}</strong>
          likes
        </div>
      </div>

      <div className="toolbar">
        <label className="select-wrap">
          <span className="sr-only">Sort</span>
          <select
            className="select"
            value={sort}
            onChange={(event) => setSort(event.target.value as BountySort)}
          >
            {SORTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="select-wrap">
          <span className="sr-only">Status</span>
          <select
            className="select"
            value={tab}
            onChange={(event) => setTab(event.target.value as BountyListTab)}
          >
            {TABS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`toolbar-btn ${tab === 'claimed' ? 'on' : ''}`}
          onClick={() => setTab('claimed')}
        >
          Submissions
        </button>
      </div>

      {loading ? (
        <EmptyTicket>Loading bounties…</EmptyTicket>
      ) : error ? (
        <div>
          <ErrorNote message={error} />
          <button type="button" className="btn-ghost mt-3" onClick={() => setReload((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : bounties.length === 0 ? (
        <EmptyTicket>
          {tab === 'open' ? (
            <>
              Nothing open yet.{' '}
              <Link to="/bounties?create=1" className="text-inherit">
                Create the first bounty
              </Link>
            </>
          ) : (
            `No ${tab === 'claimed' ? 'submissions' : tab} yet.`
          )}
        </EmptyTicket>
      ) : (
        <div className="feed">
          <FeedHead />
          {bounties.map((bounty) => (
            <BountyCard key={bounty.id} bounty={bounty} now={now} onLike={onLike} />
          ))}
        </div>
      )}
      </div>
      <SideRail
        bounties={tape}
        now={now}
        onOpenAll={() => {
          setTab('open')
          setSort('reward')
        }}
      />
      <Link to="/bounties?create=1" className="create-dock">
        <span aria-hidden="true">+</span> Create bounty
      </Link>
      <PostBountyModal
        open={createOpen}
        onClose={() => {
          const next = new URLSearchParams(params)
          next.delete('create')
          setParams(next, { replace: true })
        }}
      />
    </main>
  )
}
