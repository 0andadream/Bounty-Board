import { useState } from 'react'
import { BackKey } from '../components/BackKey.tsx'
import { Banner, ErrorNote } from '../components/ui.tsx'
import { useWallet } from '../context/WalletContext.tsx'
import { listNimiqAccounts, readNimiqNetwork, shouldUseMiniApp } from '../providers/nimiq.ts'

export function Probe() {
  const wallet = useWallet()
  const miniApp = shouldUseMiniApp()
  const [accounts, setAccounts] = useState<string[] | null>(null)
  const [consensus, setConsensus] = useState<boolean | null>(null)
  const [blockNumber, setBlockNumber] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function runCheck() {
    setError(null)
    setBusy(true)
    try {
      if (miniApp) {
        const [listed, network] = await Promise.all([listNimiqAccounts(), readNimiqNetwork()])
        setAccounts(listed)
        setConsensus(network.consensus)
        setBlockNumber(network.blockNumber)
        return
      }
      const address = wallet.nimiqAddress ?? (await wallet.connect())
      setAccounts([address])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <BackKey />
      <p className="m-0 text-[13px] text-muted">Wallet check</p>
      <h1 className="mt-1 mb-6 text-[36px] tracking-[-0.05em]">Connect</h1>
      <div className="panel max-w-[640px]">
        {miniApp ? (
          <Banner>Nimiq Pay provider detected. This check uses listAccounts().</Banner>
        ) : (
          <Banner>
            Desktop mode. Connect opens Nimiq Hub in a popup — no need to load this inside Nimiq Pay.
          </Banner>
        )}
        <button className="btn-accent" type="button" disabled={busy} onClick={() => void runCheck()}>
          {busy ? 'Working…' : miniApp ? 'Run 3 requests' : 'Connect Nimiq Hub'}
        </button>
        {accounts ? (
          <pre className="addr mt-4 mb-0 whitespace-pre-wrap">Accounts: {JSON.stringify(accounts, null, 2)}</pre>
        ) : null}
        {consensus !== null ? <pre className="addr mt-2 mb-0">Consensus: {String(consensus)}</pre> : null}
        {blockNumber !== null ? <pre className="addr mt-2 mb-0">Block: {String(blockNumber)}</pre> : null}
        {error ? <ErrorNote message={error} /> : null}
      </div>
    </main>
  )
}
