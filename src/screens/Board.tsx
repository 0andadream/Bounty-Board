import type { BountyListTab } from '@shared/types.ts'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banner, BountyCard, EmptyTicket, ErrorNote } from '../components/ui.tsx'
import { useWallet } from '../context/WalletContext.tsx'
import { listBounties } from '../lib/api.ts'
import { toErrorMessage } from '../lib/errors.ts'
import { shortWallet } from '../lib/format.ts'
import type { Bounty } from '@shared/types.ts'

const TABS: BountyListTab[] = ['open', 'claimed', 'paid']

export function BoardScreen() {
  const wallet = useWallet()
  const [tab, setTab] = useState<BountyListTab>('open')
  const [bounties, setBounties] = useState<Bounty[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const now = Date.now()

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    listBounties(tab)
      .then((rows) => {
        if (!ignore) setBounties(rows)
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
  }, [tab])

  return (
    <main className="screen">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <p className="m-0 font-mono text-[10px] tracking-[0.28em] uppercase text-paper-2">
            Nimiq Pay Mini App
          </p>
          <h1 className="mt-1 mb-0 text-[34px] leading-none text-paper">Board</h1>
        </div>
        <Link to="/probe" className="font-mono text-[10px] tracking-[0.16em] uppercase text-paper-2 no-underline">
          Probe
        </Link>
      </header>

      {wallet.status === 'connecting' ? (
        <Banner>Waiting for Nimiq Pay to initialize the provider…</Banner>
      ) : wallet.status === 'connected' && wallet.nimiqAddress ? (
        <Banner>
          Connected {shortWallet('NIM', wallet.nimiqAddress)}
          {wallet.consensus != null ? ` · consensus ${wallet.consensus ? 'yes' : 'no'}` : ''}
        </Banner>
      ) : (
        <Banner>
          Open Board inside Nimiq Pay to post, claim, and pay. You can still read the board from a
          browser.{' '}
          <button type="button" className="underline bg-transparent border-0 p-0 text-inherit" onClick={() => void wallet.connect().catch(() => undefined)}>
            Retry wallet
          </button>
        </Banner>
      )}

      <div className="paper px-4 pt-2 pb-4">
        <div className="mb-3 flex gap-5">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              className={`tab ${tab === item ? 'active' : ''}`}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>
        {loading ? (
          <EmptyTicket>Pulling tickets…</EmptyTicket>
        ) : error ? (
          <ErrorNote message={error} />
        ) : bounties.length === 0 ? (
          <EmptyTicket>
            {tab === 'open' ? 'Nothing posted. Pin a bounty.' : `No ${tab} bounties.`}
          </EmptyTicket>
        ) : (
          bounties.map((bounty) => <BountyCard key={bounty.id} bounty={bounty} now={now} />)
        )}
      </div>
    </main>
  )
}
