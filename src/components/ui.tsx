import { viewStatus } from '@shared/machine.ts'
import type { Bounty, ViewStatus } from '@shared/types.ts'
import { Link } from 'react-router-dom'
import { formatDeadline, money, shortWallet } from '../lib/format.ts'

export function Stamp({ status }: { status: ViewStatus }) {
  return <span className={`stamp ${status === 'paid' ? 'stamp-paid' : ''}`}>{status}</span>
}

export function WalletChip({ token, value }: { token: Bounty['token']; value: string }) {
  return <span className="addr">{shortWallet(token, value)}</span>
}

export function BountyCard({ bounty, now }: { bounty: Bounty; now: number }) {
  const status = viewStatus(bounty, now)
  return (
    <Link to={`/b/${bounty.id}`} className="block no-underline text-ink">
      <article className="paper ticket relative mb-3 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 font-mono text-[10px] tracking-[0.22em] uppercase text-muted">
              #{bounty.id}
            </p>
            <h2 className="mt-1 mb-0 text-[18px] leading-snug font-medium">{bounty.title}</h2>
          </div>
          <Stamp status={status} />
        </div>
        <p className="mt-3 mb-0 money text-[20px]">{money(bounty.rewardMinor, bounty.token)}</p>
        <hr className="rule my-3" />
        <p className="m-0 text-[13px] text-muted">
          Due {formatDeadline(bounty.deadline)}
          {bounty.hunter ? (
            <>
              {' · '}hunter <WalletChip token={bounty.token} value={bounty.hunter} />
            </>
          ) : null}
        </p>
      </article>
    </Link>
  )
}

export function EmptyTicket({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper px-5 py-10 text-center">
      <p className="m-0 text-[16px] italic text-muted">{children}</p>
    </div>
  )
}

export function Banner({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 mt-0 paper px-3 py-2 text-[13px] text-muted">
      {children}
    </p>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="mt-3 mb-0 font-mono text-[12px]" style={{ color: '#c42b1c' }}>
      {message}
    </p>
  )
}
