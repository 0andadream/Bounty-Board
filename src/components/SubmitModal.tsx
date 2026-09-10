import { listEntries, openSlots, winnersMax } from '@shared/machine.ts'
import { sameAddress } from '@shared/address.ts'
import type { Bounty } from '@shared/types.ts'
import { useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext.tsx'
import { useWallet } from '../context/WalletContext.tsx'
import { claimBounty, submitProof } from '../lib/api.ts'
import { toErrorMessage } from '../lib/errors.ts'
import { readBountyImage } from '../lib/image.ts'
import { ErrorNote } from './ui.tsx'

export const CONTENT_GUIDELINES = [
  { title: 'Minors present', body: 'Anyone under 18 visible, including bystanders in recordings.' },
  { title: 'Nudity', body: 'Nudity or sexually explicit content.' },
  { title: 'Violence / weapons', body: 'Graphic violence, weapons, or threatening imagery.' },
  { title: 'Doxxing', body: "Someone else's personal information shared without consent." },
  { title: 'AI generated', body: 'AI-generated work presented as authentic human proof when the brief says no AI.' },
  { title: 'Harassment', body: 'Targeted harassment, threats, or abusive content.' },
]

function deliverablesFromBrief(brief: string): string[] {
  const lines = brief
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
  if (lines.length >= 2) return lines
  const sentences = brief
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 18)
  if (sentences.length >= 2) return sentences.slice(0, 8)
  return [brief.trim()].filter(Boolean)
}

export function SubmitModal({
  bounty,
  open,
  onClose,
  onSubmitted,
}: {
  bounty: Bounty
  open: boolean
  onClose: () => void
  onSubmitted: (next: Bounty) => void
}) {
  const wallet = useWallet()
  const profile = useProfile()
  const items = deliverablesFromBrief(bounty.brief)
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false))
  const [guideOpen, setGuideOpen] = useState(true)
  const [description, setDescription] = useState('')
  const [links, setLinks] = useState<string[]>([''])
  const [files, setFiles] = useState<string[]>([])
  const [agreed, setAgreed] = useState(false)
  const [dropHot, setDropHot] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const doneCount = checked.filter(Boolean).length
  const handle = profile.me?.username ?? 'your wallet'

  async function addFiles(list: FileList | File[]) {
    setError(null)
    let next = files
    for (const file of [...list]) {
      if (next.length >= 4) break
      try {
        const data = await readBountyImage(file)
        next = [...next, data]
      } catch (err) {
        setError(toErrorMessage(err) || 'Use an image, or put other files behind a link.')
      }
    }
    setFiles(next)
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDropHot(false)
    if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files)
  }

  async function onSubmit() {
    setError(null)
    if (checked.some((value) => !value)) {
      setError('Check each deliverable once your entry covers it.')
      return
    }
    if (!description.trim()) {
      setError('Add a description of what you shipped.')
      return
    }
    if (!agreed) {
      setError('Agree to the submission terms to send this in.')
      return
    }
    const cleanLinks = links.map((link) => link.trim()).filter(Boolean)
    const needed = bounty.proofType ?? 'any'
    if (needed === 'url' && cleanLinks.length === 0) {
      setError('This bounty needs a proof URL.')
      return
    }
    if (needed === 'image' && files.length === 0) {
      setError('This bounty needs a proof photo.')
      return
    }
    if (needed === 'text' && !description.trim()) {
      setError('This bounty needs a written note.')
      return
    }
    if (needed === 'any' && cleanLinks.length === 0 && files.length === 0) {
      setError('Add a link or attach a photo so the poster can review the work.')
      return
    }
    setBusy(true)
    try {
      const hunter =
        bounty.token === 'USDT'
          ? (wallet.ethAddress ?? (await wallet.connectEthereum()))
          : (wallet.nimiqAddress ?? (await wallet.connect()))
      if (sameAddress(hunter, bounty.poster)) {
        setError('This is your bounty. Connect a different wallet to submit work.')
        return
      }
      const mine = listEntries(bounty).some((entry) => sameAddress(entry.hunter, hunter))
      if (mine) {
        setError('You already submitted on this bounty.')
        return
      }
      if (openSlots(bounty) <= 0) {
        setError('All winner slots are filled.')
        return
      }
      if (winnersMax(bounty) === 1 && bounty.status === 'open') {
        await claimBounty(bounty.id, hunter)
      }
      const next = await submitProof(bounty.id, hunter, cleanLinks.join('\n'), {
        note: description.trim(),
        image: files[0] ?? null,
        images: files,
      })
      onSubmitted(next)
      onClose()
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div
        className="submit-modal"
        role="dialog"
        aria-labelledby="submit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="submit-title" className="mt-0 mb-1 text-[26px] tracking-[-0.04em]">
          Submit your work
        </h2>
        <p className="mt-0 mb-1 text-[16px]">{bounty.title}</p>
        <p className="mt-0 mb-4 text-[13px] text-muted">
          Describe your submission. Add links or attachments to back it up.
          {bounty.hunter ? ` Hunter wallet: ${bounty.hunter}.` : ''}
          {bounty.proofType && bounty.proofType !== 'any' ? ` Proof type: ${bounty.proofType}.` : ''}
        </p>

        <div className="deliverable-box">
          <p className="mt-0 mb-1 font-semibold">Confirm bounty deliverables</p>
          <p className="mt-0 mb-3 text-[13px] text-muted">
            Check each requirement once your submission includes evidence for it.
          </p>
          <p className="mt-0 mb-3 text-[12px] text-muted">
            {doneCount}/{items.length} done
          </p>
          {items.map((item, index) => (
            <label key={`${index}-${item.slice(0, 24)}`} className="deliverable-row">
              <input
                type="checkbox"
                checked={Boolean(checked[index])}
                onChange={(event) => {
                  const next = [...checked]
                  next[index] = event.target.checked
                  setChecked(next)
                }}
              />
              <span>{item}</span>
            </label>
          ))}
        </div>

        {!profile.me ? (
          <p className="profile-warn">
            Add a username so the poster knows who submitted.{' '}
            <Link to="/profile">View your profile</Link>
          </p>
        ) : null}

        <div className="guide-box">
          <button type="button" className="guide-toggle" onClick={() => setGuideOpen((value) => !value)}>
            <span>
              <strong>Content guidelines:</strong> Minors, nudity, violence, doxxing, AI misrepresentation,
              harassment
            </span>
            <span aria-hidden="true">{guideOpen ? '⌃' : '⌄'}</span>
          </button>
          {guideOpen ? (
            <div className="guide-body">
              <p className="mt-0 mb-3 text-[13px] text-muted">
                Applies to notes, links, and attachments, including accidental background in photos:
              </p>
              {CONTENT_GUIDELINES.map((rule) => (
                <p key={rule.title} className="mt-0 mb-2 text-[13px]">
                  <strong>{rule.title}:</strong> {rule.body}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <p className="mt-5 mb-2 font-semibold">Attach files</p>
        <div
          className={`dropzone ${dropHot ? 'hot' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDropHot(true)
          }}
          onDragLeave={() => setDropHot(false)}
          onDrop={onDrop}
        >
          <p className="mt-0 mb-1 font-semibold">Drop files here</p>
          <p className="mt-0 mb-3 text-[13px] text-muted">
            Add up to 4 photos of the work. Put videos and PDFs behind a link.
          </p>
          <label className="btn-ghost inline-block">
            Choose files
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                if (event.target.files) void addFiles(event.target.files)
              }}
            />
          </label>
          {files.length > 0 ? (
            <div className="drop-thumbs">
              {files.map((src, index) => (
                <button
                  key={`${index}-${src.slice(-24)}`}
                  type="button"
                  className="drop-thumb"
                  onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                  aria-label={`Remove photo ${index + 1}`}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <label className="mt-5 mb-3 block">
          <span className="mb-1 block font-semibold">
            Description <span className="req">*</span>
          </span>
          <textarea
            className="field min-h-[120px]"
            placeholder="Tell the poster what you shipped, what's included, and anything they should review first."
            value={description}
            maxLength={500}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <p className="mt-0 mb-2 font-semibold">Links</p>
        {links.map((link, index) => (
          <input
            key={index}
            className="field mb-2"
            placeholder="https://github.com/… or https://drive.google.com/…"
            value={link}
            onChange={(event) => {
              const next = [...links]
              next[index] = event.target.value
              setLinks(next)
            }}
          />
        ))}
        <button type="button" className="link-add" onClick={() => setLinks((current) => [...current, ''])}>
          + Add link
        </button>

        <div className="terms-box">
          <p className="mt-0 mb-2 font-semibold">
            Submission terms <span className="req">*</span>
          </p>
          <p className="mt-0 mb-3 text-[13px] text-muted">
            You confirm this is your work. The poster reviews it and pays the winner wallet-to-wallet. There is no
            escrow or dispute desk.
          </p>
          <label className="agree-row">
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            <span>I agree</span>
          </label>
        </div>

        {error ? <ErrorNote message={error} /> : null}

        <div className="submit-foot">
          <p className="m-0 text-[13px] text-muted">
            Submitting as <strong>{handle}</strong>
            <br />
            No submission fee.
          </p>
          <button className="btn-accent py-3 px-6" type="button" disabled={busy} onClick={() => void onSubmit()}>
            {busy ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
