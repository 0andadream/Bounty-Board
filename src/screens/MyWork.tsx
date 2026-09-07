import { sameAddress } from '@shared/address.ts'
import type { Bounty } from '@shared/types.ts'
import { useEffect, useState } from 'react'
import { Banner, BountyCard, EmptyTicket, ErrorNote, FeedHead } from '../components/ui.tsx'
import { useWallet } from '../context/WalletContext.tsx'
import { listMyBounties, toggleLike } from '../lib/api.ts'
import { toErrorMessage } from '../lib/errors.ts'

export function MyWork() {
  const wallet = useWallet()
  const [posted, setPosted] = useState<Bounty[]>([])
  const [claimed, setClaimed] = useState<Bounty[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
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
    Promise.all(addresses.map((address) => listMyBounties(address, addresses[0])))
      .then((groups) => {
        if (ignore) return
        const all = groups.flat()
        const unique = new Map(all.map((bounty) => [bounty.id, bounty]))
        const rows = [...unique.values()]
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

  return (
    <main className="screen">
      <p className="m-0 text-[13px] text-muted">Your bounties</p>
      <h1 className="mt-1 mb-6 text-[36px] tracking-[-0.05em]">My work</h1>
      {addresses.length === 0 ? (
        <Banner>
          Connect a wallet to see bounties you posted or claimed.{' '}
          <button type="button" className="underline bg-transparent border-0 p-0 text-inherit" onClick={() => void wallet.connect().catch(() => undefined)}>
            Connect wallet
          </button>
        </Banner>
      ) : null}
      {error ? <ErrorNote message={error} /> : null}

      <h2 className="mt-2 mb-3 text-[20px]">Posted</h2>
      {loading ? (
        <EmptyTicket>Checking the board…</EmptyTicket>
      ) : posted.length === 0 ? (
        <EmptyTicket>You have not posted a bounty.</EmptyTicket>
      ) : (
        <div className="feed mb-8">
          <FeedHead />
          {posted.map((bounty) => (
            <BountyCard key={bounty.id} bounty={bounty} now={now} onLike={(item) => void onLike(item)} />
          ))}
        </div>
      )}

      <h2 className="mt-8 mb-3 text-[20px]">Claimed</h2>
      {claimed.length === 0 ? (
        <EmptyTicket>No claimed tickets on this wallet.</EmptyTicket>
      ) : (
        <div className="feed">
          <FeedHead />
          {claimed.map((bounty) => (
            <BountyCard key={bounty.id} bounty={bounty} now={now} onLike={(item) => void onLike(item)} />
          ))}
        </div>
      )}
    </main>
  )
}
