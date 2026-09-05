import { viewStatus } from '@shared/machine.ts'
import { lunaFromNimMinor } from '@shared/money.ts'
import { sameAddress } from '@shared/address.ts'
import type { Bounty } from '@shared/types.ts'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Banner, ErrorNote, Stamp } from '../components/ui.tsx'
import { useWallet } from '../context/WalletContext.tsx'
import { claimBounty, getBounty, markPaid, submitProof } from '../lib/api.ts'
import { toErrorMessage } from '../lib/errors.ts'
import { explorerUrl, formatDeadline, formatWallet, formatWhen, money } from '../lib/format.ts'
import { sendBountyPayment } from '../providers/nimiq.ts'
import { sendUsdt } from '../providers/usdt.ts'

export function BountyDetail() {
  const { id = '' } = useParams()
  const wallet = useWallet()
  const navigate = useNavigate()
  const [bounty, setBounty] = useState<Bounty | null>(null)
  const [proof, setProof] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const now = Date.now()

  useEffect(() => {
    let ignore = false
    getBounty(id)
      .then((row) => {
        if (!ignore) {
          setBounty(row)
          if (row.proof) setProof(row.proof)
        }
      })
      .catch((err) => {
        if (!ignore) setError(toErrorMessage(err))
      })
    return () => {
      ignore = true
    }
  }, [id])

  if (!bounty && error) {
    return (
      <main className="screen">
        <ErrorNote message={error} />
      </main>
    )
  }

  if (!bounty) {
    return (
      <main className="screen">
        <p className="text-paper">Loading ticket…</p>
      </main>
    )
  }

  const ticket = bounty
  const status = viewStatus(ticket, now)
  const myAddress = wallet.addressFor(ticket.token)
  const isPoster = Boolean(myAddress && sameAddress(myAddress, ticket.poster))
  const isHunter = Boolean(myAddress && ticket.hunter && sameAddress(myAddress, ticket.hunter))
  const canClaimNow = status === 'open' && !isPoster
  const canSubmitNow = ticket.status === 'claimed' && isHunter
  const canPayNow = ticket.status === 'submitted' && isPoster

  async function ensureAddress(): Promise<string> {
    if (ticket.token === 'USDT') {
      return wallet.ethAddress ?? (await wallet.connectEthereum())
    }
    return wallet.nimiqAddress ?? (await wallet.connect())
  }

  async function onClaim() {
    setError(null)
    setBusy('claim')
    try {
      const hunter = await ensureAddress()
      const next = await claimBounty(ticket.id, hunter)
      setBounty(next)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function onSubmit() {
    setError(null)
    setBusy('submit')
    try {
      const hunter = await ensureAddress()
      const next = await submitProof(ticket.id, hunter, proof)
      setBounty(next)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function onPay() {
    if (!ticket.hunter) return
    setError(null)
    setBusy('pay')
    try {
      const poster = await ensureAddress()
      const hunter = ticket.hunter
      const txHash =
        ticket.token === 'NIM'
          ? await sendBountyPayment({
              recipient: hunter,
              valueLuna: lunaFromNimMinor(ticket.rewardMinor),
              bountyId: ticket.id,
            })
          : await sendUsdt({
              from: poster,
              to: hunter,
              amountMinor: BigInt(ticket.rewardMinor),
            })
      const next = await markPaid(ticket.id, poster, txHash)
      setBounty(next)
      navigate(`/b/${next.id}/receipt`)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="screen">
      <Link to="/" className="font-mono text-[10px] tracking-[0.18em] uppercase text-paper-2 no-underline">
        ← Board
      </Link>
      <article className="paper relative mt-3 overflow-hidden px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 font-mono text-[10px] tracking-[0.22em] uppercase text-muted">#{bounty.id}</p>
            <h1 className="mt-1 mb-0 text-[26px] leading-tight">{bounty.title}</h1>
          </div>
          <Stamp status={status} />
        </div>
        <p className="mt-4 mb-0 money text-[28px]">{money(bounty.rewardMinor, bounty.token)}</p>
        <p className="mt-3 mb-0 text-[15px] leading-relaxed">{bounty.brief}</p>
        <hr className="rule my-4" />
        <dl className="m-0 grid gap-3 text-[13px]">
          <div>
            <dt className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted">Poster</dt>
            <dd className="addr m-0 mt-1">{formatWallet(bounty.token, bounty.poster)}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted">Hunter</dt>
            <dd className="addr m-0 mt-1">
              {bounty.hunter ? formatWallet(bounty.token, bounty.hunter) : '— open —'}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted">Deadline</dt>
            <dd className="m-0 mt-1">{formatDeadline(bounty.deadline)}</dd>
          </div>
        </dl>

        <h2 className="mt-6 mb-2 font-mono text-[10px] tracking-[0.22em] uppercase text-muted">Timeline</h2>
        <ol className="m-0 list-none p-0 text-[13px]">
          <li className="mb-2">Posted {formatWhen(bounty.createdAt)}</li>
          {bounty.claimedAt ? <li className="mb-2">Claimed {formatWhen(bounty.claimedAt)}</li> : null}
          {bounty.submittedAt ? (
            <li className="mb-2">
              Proof{' '}
              {bounty.proof ? (
                <a href={bounty.proof} target="_blank" rel="noreferrer" className="text-ink">
                  {bounty.proof}
                </a>
              ) : null}{' '}
              · {formatWhen(bounty.submittedAt)}
            </li>
          ) : null}
          {bounty.paidAt && bounty.txHash ? (
            <li>
              Paid {formatWhen(bounty.paidAt)} ·{' '}
              {explorerUrl(bounty.token, bounty.txHash) ? (
                <a href={explorerUrl(bounty.token, bounty.txHash)!} target="_blank" rel="noreferrer">
                  {bounty.txHash.slice(0, 18)}…
                </a>
              ) : (
                <span className="addr">{bounty.txHash}</span>
              )}
            </li>
          ) : null}
        </ol>

        {status === 'expired' ? (
          <Banner>Expired. There is no auto-revert — the poster can repost.</Banner>
        ) : null}

        {canClaimNow ? (
          <button className="btn-accent mt-5 w-full py-3" type="button" disabled={busy !== null} onClick={() => void onClaim()}>
            {busy === 'claim' ? 'Claiming…' : 'Claim this bounty'}
          </button>
        ) : null}

        {canSubmitNow ? (
          <div className="mt-5">
            <label className="mb-3 block">
              <span className="mb-1 block font-mono text-[10px] tracking-[0.18em] uppercase text-muted">
                Proof link
              </span>
              <input
                className="field"
                placeholder="https://"
                value={proof}
                onChange={(e) => setProof(e.target.value)}
              />
            </label>
            <button className="btn-accent w-full py-3" type="button" disabled={busy !== null} onClick={() => void onSubmit()}>
              {busy === 'submit' ? 'Submitting…' : 'Submit proof'}
            </button>
          </div>
        ) : null}

        {bounty.status === 'submitted' && !isPoster ? (
          <p className="mt-4 mb-0 text-[13px] text-muted">Waiting on the poster to pay from their wallet.</p>
        ) : null}

        {canPayNow ? (
          <button className="btn-accent mt-5 w-full py-3" type="button" disabled={busy !== null} onClick={() => void onPay()}>
            {busy === 'pay' ? 'Waiting on wallet…' : `Pay ${money(bounty.rewardMinor, bounty.token)}`}
          </button>
        ) : null}

        {bounty.status === 'paid' ? (
          <Link to={`/b/${bounty.id}/receipt`} className="btn-ghost mt-5 block py-3 text-center no-underline">
            Open receipt
          </Link>
        ) : null}

        {error ? <ErrorNote message={error} /> : null}
      </article>
    </main>
  )
}
