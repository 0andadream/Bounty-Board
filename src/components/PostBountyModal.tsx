import { parseToMinor } from '@shared/money.ts'
import type { ProofType, Token } from '@shared/types.ts'
import { useEffect, useState, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext.tsx'
import { useWallet } from '../context/WalletContext.tsx'
import { postBounty } from '../lib/api.ts'
import { toErrorMessage } from '../lib/errors.ts'
import { readBountyImage } from '../lib/image.ts'
import { CONTENT_GUIDELINES } from './SubmitModal.tsx'
import { ErrorNote } from './ui.tsx'

const DURATIONS = [
  { days: 1, label: '1 day' },
  { days: 3, label: '3 days' },
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
]

export function PostBountyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const wallet = useWallet()
  const profile = useProfile()
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [deliverables, setDeliverables] = useState<string[]>([''])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(7)
  const [location, setLocation] = useState('')
  const [locOpen, setLocOpen] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [legal, setLegal] = useState(false)
  const [specific, setSpecific] = useState(false)
  const [reward, setReward] = useState('2')
  const [token, setToken] = useState<Token>('NIM')
  const [proofType, setProofType] = useState<ProofType>('url')
  const [dropHot, setDropHot] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const cleanDeliverables = deliverables.map((item) => item.trim()).filter(Boolean)

  function close() {
    setStep(1)
    setError(null)
    onClose()
  }

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  async function addFile(file: File) {
    setError(null)
    try {
      setImageUrl(await readBountyImage(file))
    } catch (err) {
      setError(toErrorMessage(err))
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDropHot(false)
    const file = event.dataTransfer.files[0]
    if (file) void addFile(file)
  }

  function goRewards() {
    setError(null)
    if (title.trim().length < 3) {
      setError('Title must be at least 3 characters.')
      return
    }
    if (summary.trim().length < 8) {
      setError('Summary must be at least 8 characters.')
      return
    }
    if (cleanDeliverables.length === 0) {
      setError('Add at least one concrete deliverable.')
      return
    }
    if (!legal || !specific) {
      setError('Check both confirmations to continue.')
      return
    }
    setStep(2)
  }

  async function publish() {
    setError(null)
    setBusy(true)
    try {
      const poster =
        token === 'USDT'
          ? (wallet.ethAddress ?? (await wallet.connectEthereum()))
          : (wallet.nimiqAddress ?? (await wallet.connect()))
      const parts = [summary.trim(), ...cleanDeliverables]
      if (location.trim()) parts.push(`Location: ${location.trim()}`)
      const brief = parts.join('\n')
      if (brief.length > 2000) {
        throw new Error('Summary and deliverables together must stay under 2000 characters.')
      }
      const bounty = await postBounty({
        title: title.trim(),
        brief,
        rewardMinor: parseToMinor(reward, token).toString(),
        token,
        deadline: Date.now() + duration * 86_400_000,
        poster,
        imageUrl,
        proofType,
      })
      close()
      navigate(`/b/${bounty.id}`)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-back" onClick={close} role="presentation">
      <div
        className="post-modal"
        role="dialog"
        aria-labelledby="post-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="post-head">
          <p id="post-title" className="m-0 font-semibold">
            Post a bounty
          </p>
          <div className="step-tabs">
            <button type="button" className={`step-tab ${step === 1 ? 'on' : ''}`} onClick={() => setStep(1)}>
              <span>1</span> Details
            </button>
            <button type="button" className={`step-tab ${step === 2 ? 'on' : ''}`} onClick={goRewards}>
              <span>2</span> Rewards
            </button>
          </div>
          <button type="button" className="modal-close" onClick={close} aria-label="Close">
            ×
          </button>
        </div>

        {step === 1 ? (
          <div className="post-body">
            <p className="pool-kicker mt-0 mb-2">Step 1</p>
            <h2 className="mt-0 mb-2 text-[28px] tracking-[-0.04em]">Bounty details</h2>
            <p className="mt-0 mb-4 text-[14px] text-muted">
              Describe what you want done. Next, you will choose how much to pay the winner.
            </p>
            <p className="info-chip">
              <i>i</i>
              <span>Your spec is the rulebook. Hunters are judged against the title, summary, and deliverables.</span>
            </p>

            <label className="mb-4 block">
              <span className="mb-1 block font-semibold">
                Title <span className="req">*</span>
              </span>
              <span className="mb-2 block text-[12px] text-muted">50 characters max.</span>
              <input
                className="field"
                placeholder="What needs to get done?"
                value={title}
                maxLength={50}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label className="mb-4 block">
              <span className="mb-1 block font-semibold">
                Summary <span className="req">*</span>
              </span>
              <textarea
                className="field min-h-[120px]"
                placeholder="Describe the work, tone, deliverable, and what success looks like."
                value={summary}
                maxLength={400}
                onChange={(event) => setSummary(event.target.value)}
              />
            </label>

            <p className="mt-0 mb-2 font-semibold">Attach files</p>
            <div
              className={`dropzone mb-4 ${dropHot ? 'hot' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                setDropHot(true)
              }}
              onDragLeave={() => setDropHot(false)}
              onDrop={onDrop}
            >
              {imageUrl ? <img src={imageUrl} alt="" className="post-thumb" /> : null}
              <div className="file-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <circle cx="8.5" cy="10" r="1.5" />
                  <path d="m21 15-4.5-4.5L7 20" />
                </svg>
              </div>
              <p className="mt-0 mb-1 font-semibold">Drop files here: drag and drop here</p>
              <p className="mt-0 mb-3 text-[13px] text-muted">
                Share a cover image or supporting assets. Hunters see this on the bounty.
              </p>
              <label className="btn-ghost inline-block">
                Choose file
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void addFile(file)
                  }}
                />
              </label>
              {imageUrl ? (
                <button type="button" className="btn-ghost mt-3" onClick={() => setImageUrl(null)}>
                  Remove
                </button>
              ) : null}
            </div>

            <p className="mt-0 mb-1 font-semibold">
              Deliverables <span className="req">*</span>
            </p>
            <p className="mt-0 mb-3 text-[13px] text-muted">
              List the specific requirements hunters need to deliver. 100 characters max each, up to 10.
            </p>
            <div className="deliverable-box">
              {deliverables.map((item, index) => (
                <input
                  key={index}
                  className="field mb-2"
                  placeholder="Add deliverable"
                  maxLength={100}
                  value={item}
                  onChange={(event) => {
                    const next = [...deliverables]
                    next[index] = event.target.value
                    setDeliverables(next)
                  }}
                />
              ))}
              {deliverables.length < 10 ? (
                <button
                  type="button"
                  className="link-add"
                  onClick={() => setDeliverables((current) => [...current, ''])}
                >
                  + Add deliverable
                </button>
              ) : null}
            </div>

            {!profile.me ? (
              <p className="profile-warn">
                Add a username so hunters know who posted.{' '}
                <Link to="/profile" onClick={close}>
                  View your profile
                </Link>
              </p>
            ) : null}

            <div className="guide-box guide-amber">
              <button type="button" className="guide-toggle" onClick={() => setGuideOpen((value) => !value)}>
                <span>
                  <strong>Content guidelines:</strong> Minors, nudity, violence, doxxing, AI, harassment
                </span>
                <span aria-hidden="true">{guideOpen ? '⌃' : '⌄'}</span>
              </button>
              {guideOpen ? (
                <div className="guide-body">
                  <p className="mt-0 mb-3 text-[13px] text-muted">
                    Do not require these in deliverables. Bounties that do may be taken down:
                  </p>
                  {CONTENT_GUIDELINES.map((rule) => (
                    <p key={rule.title} className="mt-0 mb-2 text-[13px]">
                      <strong>{rule.title}:</strong> {rule.body}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            <p className="mt-5 mb-1 font-semibold">
              Reward distribution <span className="req">*</span>
            </p>
            <p className="mt-0 mb-3 text-[13px] text-muted">
              Set how many people can win. Board pays one hunter wallet-to-wallet.
            </p>
            <div className="winners-row">
              <span>Number of winners:</span>
              <input className="field winners-field" value="1" readOnly aria-label="Number of winners" />
            </div>

            <button type="button" className="option-row" onClick={() => setLocOpen((value) => !value)}>
              <span className="option-ico">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                <span>
                  <strong>Location</strong>
                  <em>Optional. Set where this bounty applies so nearby hunters can find it.</em>
                </span>
              </span>
              <span aria-hidden="true">{locOpen ? '⌃' : '⌄'}</span>
            </button>
            {locOpen ? (
              <input
                className="field mb-3"
                placeholder="City, region, or Remote"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            ) : null}

            <button type="button" className="option-row" onClick={() => setVerifyOpen((value) => !value)}>
              <span className="option-ico">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5" />
                  <circle cx="12" cy="8" r="0.8" fill="currentColor" />
                </svg>
                <span>
                  <strong>Verification</strong>
                  <em>Optional. Tell hunters how you will check the work: screenshot, live demo, or link.</em>
                </span>
              </span>
              <span aria-hidden="true">{verifyOpen ? '⌃' : '⌄'}</span>
            </button>
            {verifyOpen ? (
              <p className="mt-0 mb-3 text-[13px] text-muted">
                Put verification in the summary or a deliverable. The receipt is still a wallet-to-wallet payment.
              </p>
            ) : null}

            <label className="mb-4 block">
              <span className="mb-1 block font-semibold">
                Proof type <span className="req">*</span>
              </span>
              <span className="mb-2 block text-[12px] text-muted">What the hunter must send.</span>
              <select
                className="field"
                value={proofType}
                onChange={(event) => setProofType(event.target.value as ProofType)}
              >
                <option value="url">URL</option>
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="any">Any (note, URL, or image)</option>
              </select>
            </label>

            <label className="mb-4 block">
              <span className="mb-1 block font-semibold">
                Duration <span className="req">*</span>
              </span>
              <select
                className="field"
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
              >
                {DURATIONS.map((item) => (
                  <option key={item.days} value={item.days}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <p className="mt-0 mb-2 font-semibold">
              Confirmations <span className="req">*</span>
            </p>
            <label className="confirm-row">
              <input type="checkbox" checked={legal} onChange={(event) => setLegal(event.target.checked)} />
              <span>I confirm this bounty does not request anything illegal, exploitative, or prohibited.</span>
            </label>
            <label className="confirm-row">
              <input type="checkbox" checked={specific} onChange={(event) => setSpecific(event.target.checked)} />
              <span>
                Title, summary, and deliverables are specific. I will pay the winner wallet-to-wallet. There is no
                escrow.
              </span>
            </label>

            {error ? <ErrorNote message={error} /> : null}
          </div>
        ) : (
          <div className="post-body">
            <p className="pool-kicker mt-0 mb-2">Step 2</p>
            <h2 className="mt-0 mb-2 text-[28px] tracking-[-0.04em]">Rewards</h2>
            <p className="mt-0 mb-4 text-[14px] text-muted">
              NIM is the default. You pay the hunter from Nimiq Pay when you accept the work. USDT on Polygon is optional.
            </p>
            <div className="post-reward-grid">
              <label>
                <span className="mb-1 block font-semibold">
                  Reward in {token} <span className="req">*</span>
                </span>
                <input
                  className="field font-mono"
                  inputMode="decimal"
                  value={reward}
                  onChange={(event) => setReward(event.target.value)}
                />
              </label>
              <label>
                <span className="mb-1 block font-semibold">Asset</span>
                <select className="field" value={token} onChange={(event) => setToken(event.target.value as Token)}>
                  <option value="NIM">NIM (Nimiq Pay)</option>
                  <option value="USDT">USDT (Polygon)</option>
                </select>
              </label>
            </div>
            <p className="mt-0 mb-4 text-[13px] text-muted">
              Duration: {DURATIONS.find((item) => item.days === duration)?.label}. Number of winners: 1. Proof:{' '}
              {proofType}.{location.trim() ? ` Location: ${location.trim()}.` : ''}
            </p>
            {error ? <ErrorNote message={error} /> : null}
          </div>
        )}
        <div className="post-foot">
          {step === 1 ? (
            <>
              <button type="button" className="btn-ghost" onClick={close}>
                Cancel
              </button>
              <button type="button" className="btn-accent py-3 px-5" onClick={goRewards}>
                Continue
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" className="btn-accent py-3 px-5" disabled={busy} onClick={() => void publish()}>
                {busy ? 'Publishing…' : 'Publish bounty'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
