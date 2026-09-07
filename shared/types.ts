export type Token = 'NIM' | 'USDT'
export type StoredStatus = 'open' | 'claimed' | 'submitted' | 'paid'
export type ViewStatus = StoredStatus | 'expired'

export type Profile = {
  wallet: string
  username: string
  avatarUrl: string | null
  coverUrl: string | null
  location: string | null
  skills: string | null
}

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
  proofNote: string | null
  proofImage: string | null
  txHash: string | null
  createdAt: number
  claimedAt: number | null
  submittedAt: number | null
  paidAt: number | null
  likes: number
  liked: boolean
  imageUrl: string | null
  posterProfile?: Profile | null
  hunterProfile?: Profile | null
}

export type BoardStats = {
  live: number
  review: number
  paid: number
  likes: number
}

export type BountySort = 'new' | 'reward' | 'ending'

export type BountyListTab = 'open' | 'claimed' | 'paid'

export type MachineError = {
  ok: false
  code: string
  message: string
}

export type MachineOk = { ok: true }

export type MachineResult = MachineOk | MachineError
