import { sameAddress } from '@shared/address.ts'
import type { Bounty } from '@shared/types.ts'
import { useEffect, useState } from 'react'
import { Banner, BountyCard, EmptyTicket, ErrorNote } from '../components/ui.tsx'
import { useWallet } from '../context/WalletContext.tsx'
import { listMyBounties } from '../lib/api.ts'
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
    Promise.all(addresses.map((address) => listMyBounties(address)))
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

  return (
    <main className="screen">
      <p className="m-0 font-mono text-[10px] tracking-[0.28em] uppercase text-paper-2">Ledger</p>
      <h1 className="mt-1 mb-4 text-[28px] text-paper">My work</h1>
      {addresses.length === 0 ? (
        <Banner>Connect inside Nimiq Pay to see tickets you posted or claimed.</Banner>
      ) : null}
      {error ? <ErrorNote message={error} /> : null}

      <section className="paper mb-4 px-4 py-4">
        <h2 className="mt-0 mb-3 font-mono text-[10px] tracking-[0.22em] uppercase text-muted">Posted</h2>
        {loading ? (
          <EmptyTicket>Checking the board…</EmptyTicket>
        ) : posted.length === 0 ? (
          <EmptyTicket>You have not posted a bounty.</EmptyTicket>
        ) : (
          posted.map((bounty) => <BountyCard key={bounty.id} bounty={bounty} now={now} />)
        )}
      </section>

      <section className="paper px-4 py-4">
        <h2 className="mt-0 mb-3 font-mono text-[10px] tracking-[0.22em] uppercase text-muted">Claimed</h2>
        {claimed.length === 0 ? (
          <EmptyTicket>No claimed tickets on this wallet.</EmptyTicket>
        ) : (
          claimed.map((bounty) => <BountyCard key={bounty.id} bounty={bounty} now={now} />)
        )}
      </section>
    </main>
  )
}
