import { paymentMemo } from '@shared/money.ts'
import type { Bounty } from '@shared/types.ts'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BackKey } from '../components/BackKey.tsx'
import { ErrorNote, Stamp } from '../components/ui.tsx'
import { getBounty } from '../lib/api.ts'
import { toErrorMessage } from '../lib/errors.ts'
import {
  copyText,
  explorerUrl,
  formatWallet,
  formatWhen,
  money,
  receiptUrl,
} from '../lib/format.ts'

export function Receipt() {
  const { id = '' } = useParams()
  const [bounty, setBounty] = useState<Bounty | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let ignore = false
    setError(null)
    getBounty(id)
      .then((row) => {
        if (!ignore) setBounty(row)
      })
      .catch((err) => {
        if (!ignore) setError(toErrorMessage(err))
      })
    return () => {
      ignore = true
    }
  }, [id, reload])

  if (error) {
    return (
      <main className="screen">
        <BackKey />
        <ErrorNote message={error} />
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="btn-accent" onClick={() => setReload((n) => n + 1)}>
            Retry
          </button>
          <Link to="/bounties" className="btn-ghost inline-block no-underline">
            Open board
          </Link>
        </div>
      </main>
    )
  }

  if (!bounty) {
    return (
      <main className="screen">
        <BackKey />
        <p className="text-muted">Printing receipt…</p>
      </main>
    )
  }

  if (bounty.status !== 'paid' || !bounty.txHash || !bounty.hunter || !bounty.paidAt) {
    return (
      <main className="screen">
        <BackKey />
        <div className="paper px-4 py-8 text-center">
          <p className="m-0 italic text-muted">This ticket is not paid yet.</p>
          <Link to={`/b/${bounty.id}`} className="mt-4 inline-block text-ink">
            Back to bounty
          </Link>
        </div>
      </main>
    )
  }

  const paid = bounty
  const hunter = bounty.hunter
  const txHash = bounty.txHash
  const link = receiptUrl(paid.id)
  const explore = explorerUrl(paid.token, txHash)
  const memo = paymentMemo(paid.id)

  async function share() {
    const text = [
      `BOARD RECEIPT  PAID`,
      `${paid.title}`,
      money(paid.rewardMinor, paid.token),
      `Poster  ${formatWallet(paid.token, paid.poster)}`,
      `Hunter  ${formatWallet(paid.token, hunter)}`,
      `Tx      ${txHash}`,
      paid.token === 'NIM' ? `Memo    ${memo}` : null,
      link,
    ]
      .filter(Boolean)
      .join('\n')

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Board receipt', text, url: link })
        return
      } catch {
        // fall through to copy
      }
    }
    await copyText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <main className="screen">
      <BackKey />
      <article className="paper relative mt-3 overflow-hidden">
        <div className="perforation">
          <span />
        </div>
        <div className="px-5 pb-6 pt-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="m-0 font-mono text-[10px] tracking-[0.28em] uppercase text-muted">Board receipt</p>
              <p className="mt-1 mb-0 font-mono text-[12px] tracking-[0.16em] text-muted">#{bounty.id}</p>
            </div>
            <Stamp status="paid" />
          </div>
          <h1 className="mt-5 mb-1 text-[22px] leading-tight">{bounty.title}</h1>
          <p className="mt-3 mb-0 money text-[32px]">{money(bounty.rewardMinor, bounty.token)}</p>
          <hr className="rule my-5" />
          <p className="m-0 font-mono text-[10px] tracking-[0.18em] uppercase text-muted">Poster</p>
          <p className="addr mt-1 mb-4">{formatWallet(bounty.token, bounty.poster)}</p>
          <p className="m-0 font-mono text-[10px] tracking-[0.18em] uppercase text-muted">Hunter</p>
          <p className="addr mt-1 mb-4">{formatWallet(bounty.token, bounty.hunter)}</p>
          <p className="m-0 font-mono text-[10px] tracking-[0.18em] uppercase text-muted">Transaction</p>
          <p className="addr mt-1 mb-1">
            {explore ? (
              <a href={explore} target="_blank" rel="noreferrer">
                {bounty.txHash}
              </a>
            ) : (
              bounty.txHash
            )}
          </p>
          {bounty.token === 'NIM' ? (
            <p className="mt-0 mb-4 font-mono text-[12px] text-muted">memo {memo}</p>
          ) : (
            <p className="mt-0 mb-4 font-mono text-[12px] text-muted">USDT on Polygon</p>
          )}
          <p className="m-0 font-mono text-[10px] tracking-[0.18em] uppercase text-muted">Paid</p>
          <p className="mt-1 mb-0">{formatWhen(bounty.paidAt)}</p>
          {bounty.proof ? (
            <>
              <p className="mt-4 mb-0 font-mono text-[10px] tracking-[0.18em] uppercase text-muted">Proof</p>
              <p className="mt-1 mb-0 break-all text-[13px]">
                <a href={bounty.proof} target="_blank" rel="noreferrer">
                  {bounty.proof}
                </a>
              </p>
            </>
          ) : null}
        </div>
        <div className="perforation">
          <span />
        </div>
      </article>
      <button className="btn-accent mt-4 w-full py-3" type="button" onClick={() => void share()}>
        {copied ? 'Copied' : 'Share receipt'}
      </button>
    </main>
  )
}
