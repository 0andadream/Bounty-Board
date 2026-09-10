import {
  entryImages,
  isAccepting,
  listEntries,
  openSlots,
  paidCount,
  viewStatus,
  winnersMax,
} from '@shared/machine.ts'
import { awaitingPay, posterPaidLabel } from '@shared/trust.ts'
import { lunaFromNimMinor, parseToMinor } from '@shared/money.ts'
import { sameAddress } from '@shared/address.ts'
import type { Bounty } from '@shared/types.ts'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BackKey } from '../components/BackKey.tsx'
import { SubmitModal } from '../components/SubmitModal.tsx'
import { Avatar, Banner, ErrorNote, LikeButton, PersonLine, Stamp } from '../components/ui.tsx'
import { useWallet } from '../context/WalletContext.tsx'
import { boostBounty, getBounty, markPaid, toggleLike } from '../lib/api.ts'
import { toErrorMessage } from '../lib/errors.ts'
import {
  actorName,
  amountNumber,
  countdownClock,
  explorerUrl,
  formatWhen,
  money,
  timeAgo,
  timeProgress,
} from '../lib/format.ts'
import { sendBountyPayment } from '../providers/pay.ts'
import { sendUsdt } from '../providers/usdt.ts'

export function BountyDetail() {
  const { id = '' } = useParams()
  const wallet = useWallet()
  const navigate = useNavigate()
  const [bounty, setBounty] = useState<Bounty | null>(null)
  const [boostAmount, setBoostAmount] = useState('')
  const [boostOpen, setBoostOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [reload, setReload] = useState(0)
  const [feedTab, setFeedTab] = useState<'submissions' | 'winners' | 'contributors'>('submissions')

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let ignore = false
    setError(null)
    getBounty(id, wallet.nimiqAddress ?? wallet.ethAddress)
      .then((row) => {
        if (!ignore) setBounty(row)
      })
      .catch((err) => {
        if (!ignore) setError(toErrorMessage(err))
      })
    return () => {
      ignore = true
    }
  }, [id, wallet.nimiqAddress, wallet.ethAddress, reload])

  if (!bounty && error) {
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
        <p className="text-muted">Loading bounty…</p>
      </main>
    )
  }

  const ticket = bounty
  const status = viewStatus(ticket, now)
  const myAddress = wallet.addressFor(ticket.token)
  const isPoster = Boolean(myAddress && sameAddress(myAddress, ticket.poster))
  const entries = listEntries(ticket)
  const isHunter = Boolean(
    myAddress && entries.some((entry) => sameAddress(entry.hunter, myAddress)),
  )
  const showSubmit = status !== 'expired' && !isPoster && openSlots(ticket) > 0 && !isHunter
  const unpaidEntries = entries.filter((entry) => entry.status === 'submitted')
  const needsPosterWallet = unpaidEntries.length > 0 && !isPoster && !isHunter
  const posterWalletConnected = Boolean(myAddress)
  const canPayNow = unpaidEntries.length > 0 && isPoster
  const maxWinners = winnersMax(ticket)
  const paidWinners = paidCount(ticket)
  const canBoost = status !== 'paid' && status !== 'expired'
  const progress = timeProgress(ticket.createdAt, ticket.deadline, now)

  async function ensureAddress(): Promise<string> {
    if (ticket.token === 'USDT') {
      return wallet.ethAddress ?? (await wallet.connectEthereum())
    }
    return wallet.nimiqAddress ?? (await wallet.connect())
  }

  async function onLike() {
    setError(null)
    try {
      const walletId = wallet.nimiqAddress ?? wallet.ethAddress ?? (await wallet.connect())
      setBounty(await toggleLike(ticket.id, walletId))
    } catch (err) {
      setError(toErrorMessage(err))
    }
  }

  async function onBoost() {
    if (!boostOpen) {
      setBoostOpen(true)
      return
    }
    setError(null)
    setBusy('boost')
    try {
      const from = await ensureAddress()
      const amountMinor = parseToMinor(boostAmount, ticket.token).toString()
      const next = await boostBounty(ticket.id, from, amountMinor)
      setBounty(next)
      setBoostAmount('')
      setBoostOpen(false)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function onPay(hunter: string) {
    setError(null)
    setBusy('pay')
    try {
      const poster = await ensureAddress()
      const txHash =
        ticket.token === 'NIM'
          ? await sendBountyPayment({
              recipient: hunter,
              valueLuna: lunaFromNimMinor(ticket.rewardMinor),
              bountyId: ticket.id,
              sender: poster,
            })
          : await sendUsdt({
              from: poster,
              to: hunter,
              amountMinor: BigInt(ticket.rewardMinor),
            })
      const next = await markPaid(ticket.id, poster, txHash, ticket.token, hunter)
      setBounty(next)
      if (paidCount(next) >= winnersMax(next)) navigate(`/b/${next.id}/receipt`)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="bounty-page">
      <div className="bounty-main">
        <p className="bounty-crumb">
          <Link to="/bounties" className="text-muted no-underline">
            Bounties
          </Link>
          <span className="text-muted"> / </span>
          <span>{bounty.title}</span>
        </p>

        <div className="bounty-status-row">
          <BackKey />
          <Stamp status={status} />
          <span className="token-pill">{bounty.token}</span>
          <LikeButton likes={bounty.likes} liked={bounty.liked} onToggle={() => void onLike()} />
        </div>

        <h1 className="bounty-title">{bounty.title}</h1>

        <div className="poster-row">
          <Avatar profile={bounty.posterProfile} wallet={bounty.poster} />
          <div>
            {bounty.posterProfile ? (
              <Link to={`/u/${bounty.posterProfile.username}`} className="no-underline font-semibold">
                {bounty.posterProfile.username}
              </Link>
            ) : (
              <span className="font-semibold">{actorName(bounty.token, bounty.poster, bounty.posterProfile)}</span>
            )}
            <p className="m-0 text-[13px] text-muted">Posted {timeAgo(bounty.createdAt, now)}</p>
            <p className="trust-mini mt-1 mb-0">{posterPaidLabel(bounty.posterTrust)}</p>
          </div>
        </div>

        {bounty.demo ? (
          <Banner>Demo bounty — pay still goes to the hunter’s wallet when the poster pays.</Banner>
        ) : null}
        {awaitingPay(ticket, now) ? <Banner>Awaiting pay. Hunter submitted and is waiting on the poster.</Banner> : null}

        <section className="brief-box">
          <p className="mt-0 mb-0 text-[15px] leading-relaxed whitespace-pre-wrap">{bounty.brief}</p>
        </section>

        {bounty.imageUrl ? (
          <div className="bounty-hero">
            <img src={bounty.imageUrl} alt="" />
          </div>
        ) : null}

        <section className="sub-feed">
          <nav className="sub-tabs" aria-label="Bounty activity">
            {(
              [
                { id: 'submissions' as const, label: 'Submissions', count: entries.length },
                { id: 'winners' as const, label: 'Winners', count: paidWinners },
                {
                  id: 'contributors' as const,
                  label: 'Contributors',
                  count: new Set(entries.map((entry) => entry.hunter)).size,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`sub-tab ${feedTab === tab.id ? 'on' : ''}`}
                onClick={() => setFeedTab(tab.id)}
              >
                {tab.label} <span>{tab.count}</span>
              </button>
            ))}
          </nav>

          {feedTab === 'contributors' ? (
            <div className="sub-list">
              {entries.length === 0 ? (
                <p className="text-muted">No contributors yet.</p>
              ) : (
                [...new Map(entries.map((entry) => [entry.hunter, entry])).values()].map((entry) => (
                  <div key={entry.hunter} className="sub-card">
                    <PersonLine token={ticket.token} wallet={entry.hunter} profile={entry.hunterProfile} />
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="sub-list">
              {(feedTab === 'winners' ? entries.filter((entry) => entry.status === 'paid') : entries).length === 0 ? (
                <p className="text-muted">
                  {feedTab === 'winners'
                    ? 'No winners yet.'
                    : isPoster
                      ? `Nobody has submitted yet. Up to ${maxWinners} hunter${maxWinners === 1 ? '' : 's'} can win.`
                      : 'No submissions yet. Be the first.'}
                </p>
              ) : (
                (feedTab === 'winners' ? entries.filter((entry) => entry.status === 'paid') : entries).map((entry) => {
                  const photos = entryImages(entry)
                  return (
                    <article key={`${entry.hunter}-${entry.submittedAt}`} className="sub-card">
                      <header className="sub-head">
                        <Avatar profile={entry.hunterProfile} wallet={entry.hunter} />
                        <div className="min-w-0">
                          {entry.hunterProfile ? (
                            <Link
                              to={`/u/${entry.hunterProfile.username}`}
                              className="no-underline font-semibold"
                            >
                              {entry.hunterProfile.username}
                            </Link>
                          ) : (
                            <span className="font-semibold">
                              {actorName(ticket.token, entry.hunter, entry.hunterProfile)}
                            </span>
                          )}
                          <p className="m-0 text-[13px] text-muted">
                            Published {entry.submittedAt ? timeAgo(entry.submittedAt, now) : 'just now'}
                          </p>
                        </div>
                        <span className={`sub-pill ${entry.status === 'paid' ? 'win' : ''}`}>
                          {entry.status === 'paid' ? 'Winner' : 'Submission'}
                        </span>
                      </header>
                      {entry.proofNote ? (
                        <p className="sub-note">{entry.proofNote}</p>
                      ) : null}
                      {entry.proof
                        ? entry.proof.split('\n').map((url) => (
                            <p key={url} className="mt-0 mb-2 text-[14px]">
                              <a href={url} target="_blank" rel="noreferrer">
                                {url}
                              </a>
                            </p>
                          ))
                        : null}
                      {photos.length > 0 ? (
                        <div className={`sub-gallery ${photos.length > 1 ? 'multi' : ''}`}>
                          {photos.map((src, index) => (
                            <img key={`${index}-${src.slice(-24)}`} src={src} alt="" />
                          ))}
                        </div>
                      ) : null}
                      {isPoster && entry.status === 'submitted' ? (
                        <button
                          className="btn-accent mt-4 py-3 px-5"
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void onPay(entry.hunter)}
                        >
                          {busy === 'pay'
                            ? 'Waiting on Nimiq Pay…'
                            : `Pay hunter in ${bounty.token} · ${money(bounty.rewardMinor, bounty.token)}`}
                        </button>
                      ) : null}
                    </article>
                  )
                })
              )}
            </div>
          )}
        </section>

        <section className="mt-6">
          <h2 className="pool-kicker mt-0 mb-3">Timeline</h2>
          <ol className="m-0 list-none p-0 text-[13px] text-muted">
            <li className="mb-2">Posted {formatWhen(bounty.createdAt)}</li>
            {bounty.claimedAt ? <li className="mb-2">Claimed {formatWhen(bounty.claimedAt)}</li> : null}
            {bounty.submittedAt ? (
              <li className="mb-2">
                Proof{' '}
                {bounty.proof ? (
                  <a href={bounty.proof} target="_blank" rel="noreferrer">
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
        </section>
      </div>

      <aside className="pool-card">
        <p className="pool-kicker mt-0 mb-2">Total reward pool</p>
        <p className="pool-amount">
          {amountNumber((BigInt(bounty.rewardMinor) * BigInt(maxWinners)).toString(), bounty.token)}
        </p>
        <p className="pool-kicker mt-5 mb-2">Token breakdown</p>
        <p className="m-0 flex items-center justify-between text-[15px]">
          <span className="money">{amountNumber(bounty.rewardMinor, bounty.token)}</span>
          <span className="text-muted">{bounty.token} each</span>
        </p>
        <p className="pool-kicker mt-5 mb-2">Reward distribution</p>
        <p className="mt-0 mb-0 text-[15px]">
          {maxWinners} winner{maxWinners === 1 ? '' : 's'} · {paidWinners}/{maxWinners} paid
        </p>

        <p className="pool-kicker mt-5 mb-2">Time left</p>
        <p className="countdown">{countdownClock(bounty.deadline, now)}</p>
        <div className="pool-bar" aria-hidden="true">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>

        {status === 'expired' ? <Banner>Expired. The poster can repost.</Banner> : null}

        {showSubmit ? (
          <button className="btn-submit-work" type="button" onClick={() => setSubmitOpen(true)}>
            Submit work
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        ) : null}

        {entries.some((entry) => entry.proof) ? (
          <p className="mt-3 mb-0 text-[13px] text-muted">
            {entries.length} submission{entries.length === 1 ? '' : 's'} in.
          </p>
        ) : null}

        {openSlots(ticket) <= 0 && !isHunter && !isPoster && status !== 'paid' ? (
          <p className="mt-4 mb-0 text-[13px] text-muted">All winner slots are filled. Boost the pool while they work.</p>
        ) : null}

        {ticket.status === 'submitted' && isHunter && !isPoster ? (
          <p className="mt-4 mb-0 text-[13px] text-muted">Your work is in for review. Waiting on the poster to pay.</p>
        ) : null}

        {needsPosterWallet ? (
          <div className="mt-4">
            <p className="mt-0 mb-3 text-[13px] text-muted">
              {posterWalletConnected
                ? 'This wallet did not post this bounty. Connect the poster wallet in Nimiq Pay or Hub. The bounty stays submitted until a tx hash comes back.'
                : 'Connect the poster wallet in Nimiq Pay or Hub to pay the hunter. The bounty stays submitted until a tx hash comes back.'}
            </p>
            <button
              type="button"
              className="btn-accent w-full py-3"
              onClick={() => {
                setError(null)
                void (ticket.token === 'USDT' ? wallet.connectEthereum() : wallet.connect()).catch((err) =>
                  setError(toErrorMessage(err)),
                )
              }}
            >
              Connect to pay
            </button>
          </div>
        ) : null}

        {canPayNow && unpaidEntries[0] ? (
          <button
            className="btn-accent w-full py-3 mt-5"
            type="button"
            disabled={busy !== null}
            onClick={() => void onPay(unpaidEntries[0].hunter)}
          >
            {busy === 'pay'
              ? 'Waiting on Nimiq Pay…'
              : `Pay hunter in ${bounty.token} · ${money(bounty.rewardMinor, bounty.token)}`}
          </button>
        ) : null}

        {isAccepting(ticket, now) ? (
          <p className="mt-3 mb-0 text-[13px] text-muted">
            {openSlots(ticket)} of {maxWinners} winner slot{maxWinners === 1 ? '' : 's'} open.
          </p>
        ) : null}

        {canBoost ? (
          <div className="mt-3">
            {boostOpen ? (
              <input
                className="field mb-3"
                inputMode="decimal"
                placeholder={`Amount in ${bounty.token}`}
                value={boostAmount}
                onChange={(event) => setBoostAmount(event.target.value)}
              />
            ) : null}
            <button className="btn-boost" type="button" disabled={busy !== null} onClick={() => void onBoost()}>
              <span className="btn-boost-plus">+</span>
              <span>
                <strong>Boost the pool</strong>
                <em>Add to reward pool</em>
              </span>
            </button>
          </div>
        ) : null}

        {bounty.status === 'paid' ? (
          <Link to={`/b/${bounty.id}/receipt`} className="btn-ghost mt-5 block py-3 text-center no-underline">
            Open receipt
          </Link>
        ) : null}

        <div className="deliverables">
          <p className="pool-kicker mt-0 mb-2">Deliverables</p>
          <p className="mt-0 mb-0 text-[13px] leading-relaxed text-muted">{bounty.brief}</p>
        </div>

        {error ? <ErrorNote message={error} /> : null}
      </aside>

      <SubmitModal
        bounty={ticket}
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onSubmitted={setBounty}
      />
    </main>
  )
}
