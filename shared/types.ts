export type Token = 'NIM' | 'USDT'
export type StoredStatus = 'open' | 'claimed' | 'submitted' | 'paid'
export type ViewStatus = StoredStatus | 'expired'

export type Bounty = {
  id: string
  title: string
  brief: string
  rewardMinor: string
  token: Token
  deadline: number
  status: StoredStatus
  poster: string
  hunter: string | null
  proof: string | null
  txHash: string | null
  createdAt: number
  claimedAt: number | null
  submittedAt: number | null
  paidAt: number | null
}

export type BountyListTab = 'open' | 'claimed' | 'paid'

export type MachineError = {
  ok: false
  code: string
  message: string
}

export type MachineOk = { ok: true }

export type MachineResult = MachineOk | MachineError
