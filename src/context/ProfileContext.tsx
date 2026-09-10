import { likeWalletKey } from '@shared/address.ts'
import type { Profile } from '@shared/types.ts'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getProfileByWallet, saveProfile as postProfile } from '../lib/api.ts'
import { useWallet } from './WalletContext.tsx'

type ProfileContextValue = {
  me: Profile | null
  wallet: string | null
  ready: boolean
  save: (input: {
    username: string
    avatarUrl: string | null
    coverUrl?: string | null
    location?: string | null
    skills?: string | null
  }) => Promise<Profile>
  refresh: () => Promise<void>
}

const CACHE_KEY = 'board.profile'
const ProfileContext = createContext<ProfileContextValue | null>(null)

function readCache(): { key: string; profile: Profile } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY) ?? sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { key?: string; profile?: Profile }
    if (!parsed.key || !parsed.profile?.username) return null
    return { key: parsed.key, profile: parsed.profile }
  } catch {
    return null
  }
}

function writeCache(wallet: string, profile: Profile) {
  const payload = JSON.stringify({ key: likeWalletKey(wallet), profile })
  try {
    localStorage.setItem(CACHE_KEY, payload)
  } catch {
    // Mini App WebViews can block localStorage
  }
  try {
    sessionStorage.setItem(CACHE_KEY, payload)
  } catch {
    // ignore
  }
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem(CACHE_KEY)
  } catch {
    // ignore
  }
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet()
  const walletId = wallet.nimiqAddress ?? wallet.ethAddress
  const cached = readCache()
  const [me, setMe] = useState<Profile | null>(() => cached?.profile ?? null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    const candidates = [wallet.nimiqAddress, wallet.ethAddress].filter((value): value is string => Boolean(value))
    if (candidates.length === 0) {
      if (wallet.status === 'connecting') return
      if (wallet.status !== 'disconnected') return
      setReady(true)
      return
    }
    try {
      for (const id of candidates) {
        const profile = await getProfileByWallet(id)
        if (profile) {
          setMe(profile)
          writeCache(id, profile)
          setReady(true)
          return
        }
      }
      const hit = readCache()
      if (hit && candidates.some((id) => likeWalletKey(id) === hit.key)) {
        setMe(hit.profile)
      } else {
        setMe(null)
      }
    } catch {
      const hit = readCache()
      if (hit && candidates.some((id) => likeWalletKey(id) === hit.key)) setMe(hit.profile)
    } finally {
      setReady(true)
    }
  }, [wallet.nimiqAddress, wallet.ethAddress, wallet.status])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = useCallback(
    async (input: {
      username: string
      avatarUrl: string | null
      coverUrl?: string | null
      location?: string | null
      skills?: string | null
    }) => {
      const id = wallet.nimiqAddress ?? wallet.ethAddress
      if (!id) throw new Error('Connect a wallet to set a profile.')
      const next = await postProfile({ wallet: id, ...input })
      setMe(next)
      writeCache(id, next)
      return next
    },
    [wallet.nimiqAddress, wallet.ethAddress],
  )

  useEffect(() => {
    if (wallet.status === 'disconnected' && !wallet.nimiqAddress && !wallet.ethAddress) {
      const hit = readCache()
      if (!hit) {
        setMe(null)
        clearCache()
      }
    }
  }, [wallet.status, wallet.nimiqAddress, wallet.ethAddress])

  const value = useMemo<ProfileContextValue>(
    () => ({ me, wallet: walletId, ready, save, refresh }),
    [me, walletId, ready, save, refresh],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile(): ProfileContextValue {
  const value = useContext(ProfileContext)
  if (!value) throw new Error('useProfile must be used inside ProfileProvider')
  return value
}
