import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppError, classifyWalletError, toErrorMessage } from '../lib/errors.ts'
import { chooseHubAddress } from '../providers/hub.ts'
import { hostLanguage, listNimiqAccounts, readNimiqNetwork, shouldUseMiniApp } from '../providers/nimiq.ts'
import { requestEthAccounts } from '../providers/usdt.ts'

type WalletStatus = 'connecting' | 'connected' | 'unavailable' | 'disconnected' | 'error'

type WalletContextValue = {
  status: WalletStatus
  nimiqAddress: string | null
  ethAddress: string | null
  consensus: boolean | null
  blockNumber: number | null
  error: string | null
  insideNimiqPay: boolean
  language: string
  connect: () => Promise<string>
  connectEthereum: () => Promise<string>
  disconnect: () => void
  addressFor: (token: 'NIM' | 'USDT') => string | null
}

const STORAGE_KEY = 'board.wallets'
const WalletContext = createContext<WalletContextValue | null>(null)

function loadStored(): { nimiq: string | null; eth: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { nimiq: null, eth: null }
    const parsed = JSON.parse(raw) as { nimiq?: string; eth?: string }
    return { nimiq: parsed.nimiq ?? null, eth: parsed.eth ?? null }
  } catch {
    return { nimiq: null, eth: null }
  }
}

function saveStored(nimiq: string | null, eth: string | null) {
  if (!nimiq && !eth) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ nimiq, eth }))
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const stored = loadStored()
  const [status, setStatus] = useState<WalletStatus>(stored.nimiq ? 'connected' : 'disconnected')
  const [nimiqAddress, setNimiqAddress] = useState<string | null>(stored.nimiq)
  const [ethAddress, setEthAddress] = useState<string | null>(stored.eth)
  const [consensus, setConsensus] = useState<boolean | null>(null)
  const [blockNumber, setBlockNumber] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [insideNimiqPay, setInsideNimiqPay] = useState(false)
  const language = hostLanguage()

  const connect = useCallback(async () => {
    setStatus('connecting')
    setError(null)
    try {
      if (shouldUseMiniApp()) {
        const accounts = await listNimiqAccounts()
        const address = accounts[0]
        if (!address) {
          throw new AppError('wallet_disconnected', 'No Nimiq account is available in this wallet.', true)
        }
        setNimiqAddress(address)
        setInsideNimiqPay(true)
        setStatus('connected')
        saveStored(address, ethAddress)
        try {
          const network = await readNimiqNetwork()
          setConsensus(network.consensus)
          setBlockNumber(network.blockNumber)
        } catch {
          setConsensus(null)
          setBlockNumber(null)
        }
        return address
      }

      const chosen = await chooseHubAddress()
      setNimiqAddress(chosen.nimiq)
      if (chosen.eth) setEthAddress(chosen.eth)
      setInsideNimiqPay(false)
      setStatus('connected')
      saveStored(chosen.nimiq, chosen.eth ?? ethAddress)
      return chosen.nimiq
    } catch (err) {
      const appError = err instanceof AppError ? err : classifyWalletError(err)
      setError(appError.message)
      if (!nimiqAddress) setStatus(appError.code === 'wallet_unavailable' ? 'unavailable' : 'error')
      else setStatus('connected')
      throw appError
    }
  }, [ethAddress, nimiqAddress])

  const connectEthereum = useCallback(async () => {
    try {
      const accounts = await requestEthAccounts()
      if (!accounts[0]) throw new AppError('wallet_disconnected', 'No Ethereum account connected.', true)
      setEthAddress(accounts[0])
      setStatus((current) => (current === 'connected' ? current : 'connected'))
      saveStored(nimiqAddress, accounts[0])
      return accounts[0]
    } catch (err) {
      setError(toErrorMessage(err))
      throw err
    }
  }, [nimiqAddress])

  const disconnect = useCallback(() => {
    setNimiqAddress(null)
    setEthAddress(null)
    setConsensus(null)
    setBlockNumber(null)
    setStatus('disconnected')
    setError(null)
    saveStored(null, null)
  }, [])

  useEffect(() => {
    let ignore = false
    let timer = 0
    let tries = 0

    async function boot() {
      if (!shouldUseMiniApp()) {
        if (tries++ < 50 && !ignore) {
          timer = window.setTimeout(() => void boot(), 100)
        }
        return
      }
      setInsideNimiqPay(true)
      setStatus('connecting')
      try {
        const accounts = await listNimiqAccounts()
        const address = accounts[0]
        if (!address || ignore) return
        setNimiqAddress(address)
        setStatus('connected')
        saveStored(address, loadStored().eth)
        try {
          const network = await readNimiqNetwork()
          if (!ignore) {
            setConsensus(network.consensus)
            setBlockNumber(network.blockNumber)
          }
        } catch {
          if (!ignore) {
            setConsensus(null)
            setBlockNumber(null)
          }
        }
      } catch {
        if (!ignore) setStatus(loadStored().nimiq ? 'connected' : 'disconnected')
      }
    }

    void boot()
    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [])

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      nimiqAddress,
      ethAddress,
      consensus,
      blockNumber,
      error,
      insideNimiqPay,
      language,
      connect,
      connectEthereum,
      disconnect,
      addressFor: (token) => (token === 'NIM' ? nimiqAddress : ethAddress),
    }),
    [
      status,
      nimiqAddress,
      ethAddress,
      consensus,
      blockNumber,
      error,
      insideNimiqPay,
      language,
      connect,
      connectEthereum,
      disconnect,
    ],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext)
  if (!value) throw new Error('useWallet must be used inside WalletProvider')
  return value
}
