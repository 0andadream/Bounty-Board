import type { Profile } from '@shared/types.ts'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getProfileByWallet, saveProfile as postProfile } from '../lib/api.ts'
import { useWallet } from './WalletContext.tsx'

type ProfileContextValue = {
  me: Profile | null
  wallet: string | null
  save: (username: string, avatarUrl: string | null) => Promise<Profile>
  refresh: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet()
  const walletId = wallet.nimiqAddress ?? wallet.ethAddress
  const [me, setMe] = useState<Profile | null>(null)

  const refresh = useCallback(async () => {
    if (!walletId) {
      setMe(null)
      return
    }
    try {
      const profile = await getProfileByWallet(walletId)
      if (profile) {
        setMe(profile)
        return
      }
      if (wallet.ethAddress && wallet.ethAddress !== walletId) {
        setMe(await getProfileByWallet(wallet.ethAddress))
        return
      }
      setMe(null)
    } catch {
      setMe(null)
    }
  }, [walletId, wallet.ethAddress])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = useCallback(
    async (username: string, avatarUrl: string | null) => {
      if (!walletId) throw new Error('Connect a wallet to set a profile.')
      const next = await postProfile({ wallet: walletId, username, avatarUrl })
      setMe(next)
      return next
    },
    [walletId],
  )

  const value = useMemo<ProfileContextValue>(
    () => ({ me, wallet: walletId, save, refresh }),
    [me, walletId, save, refresh],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile(): ProfileContextValue {
  const value = useContext(ProfileContext)
  if (!value) throw new Error('useProfile must be used inside ProfileProvider')
  return value
}
