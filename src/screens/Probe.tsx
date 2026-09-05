import { useEffect, useState } from 'react'
import { Banner, ErrorNote } from '../components/ui.tsx'
import { useWallet } from '../context/WalletContext.tsx'
import { getNimiqProvider, listNimiqAccounts, readNimiqNetwork } from '../providers/nimiq.ts'

export function Probe() {
  const wallet = useWallet()
  const [ready, setReady] = useState(false)
  const [connecting, setConnecting] = useState(true)
  const [accounts, setAccounts] = useState<string[] | null>(null)
  const [consensus, setConsensus] = useState<boolean | null>(null)
  const [blockNumber, setBlockNumber] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    async function connect() {
      try {
        await getNimiqProvider()
        if (!ignore) setReady(true)
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!ignore) setConnecting(false)
      }
    }
    void connect()
    return () => {
      ignore = true
    }
  }, [])

  async function runThreeRequests() {
    setError(null)
    try {
      const [listed, network] = await Promise.all([listNimiqAccounts(), readNimiqNetwork()])
      setAccounts(listed)
      setConsensus(network.consensus)
      setBlockNumber(network.blockNumber)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <main className="screen">
      <p className="m-0 font-mono text-[10px] tracking-[0.28em] uppercase text-paper-2">Step 0</p>
      <h1 className="mt-1 mb-4 text-[28px] text-paper">Provider probe</h1>
      <div className="paper px-4 py-5">
        {connecting ? <Banner>Waiting for Nimiq Pay to initialize the provider…</Banner> : null}
        {!connecting && !ready ? (
          <Banner>Open this Mini App inside Nimiq Pay to connect to the Nimiq provider.</Banner>
        ) : null}
        <p className="mt-0 mb-4 text-[14px] leading-relaxed text-muted">
          Official tutorial check. Uses only <span className="addr">listAccounts()</span>,{' '}
          <span className="addr">isConsensusEstablished()</span>, and{' '}
          <span className="addr">getBlockNumber()</span>. If accounts come back empty, stop — nothing
          downstream matters until this works.
        </p>
        <button className="btn-accent w-full py-3" type="button" disabled={connecting || !ready} onClick={() => void runThreeRequests()}>
          Run 3 requests
        </button>
        {accounts ? (
          <pre className="addr mt-4 mb-0 whitespace-pre-wrap">Accounts: {JSON.stringify(accounts, null, 2)}</pre>
        ) : null}
        {consensus !== null ? <pre className="addr mt-2 mb-0">Consensus: {String(consensus)}</pre> : null}
        {blockNumber !== null ? <pre className="addr mt-2 mb-0">Block: {String(blockNumber)}</pre> : null}
        {wallet.nimiqAddress ? (
          <p className="mt-4 mb-0 text-[13px] text-muted">Session wallet {wallet.nimiqAddress}</p>
        ) : null}
        {error ? <ErrorNote message={error} /> : null}
      </div>
    </main>
  )
}
