import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppError, classifyWalletError, toErrorMessage } from '../lib/errors.ts'
import { hostLanguage, listNimiqAccounts, readNimiqNetwork } from '../providers/nimiq.ts'
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
  addressFor: (token: 'NIM' | 'USDT') => string | null
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>('connecting')
  const [nimiqAddress, setNimiqAddress] = useState<string | null>(null)
  const [ethAddress, setEthAddress] = useState<string | null>(null)
  const [consensus, setConsensus] = useState<boolean | null>(null)
  const [blockNumber, setBlockNumber] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [insideNimiqPay, setInsideNimiqPay] = useState(false)
  const language = hostLanguage()

  const connect = useCallback(async () => {
    setStatus('connecting')
    setError(null)
    try {
      const accounts = await listNimiqAccounts()
      const address = accounts[0]
      if (!address) {
        throw new AppError('wallet_disconnected', 'No Nimiq account is available in this wallet.', true)
      }
      setNimiqAddress(address)
      setInsideNimiqPay(true)
      setStatus('connected')
      try {
        const network = await readNimiqNetwork()
        setConsensus(network.consensus)
        setBlockNumber(network.blockNumber)
      } catch {
        setConsensus(null)
        setBlockNumber(null)
      }
      return address
    } catch (err) {
      const appError = err instanceof AppError ? err : classifyWalletError(err)
      setNimiqAddress(null)
      setError(appError.message)
      setStatus(appError.code === 'wallet_unavailable' ? 'unavailable' : 'error')
      throw appError
    }
  }, [])

  const connectEthereum = useCallback(async () => {
    try {
      const accounts = await requestEthAccounts()
      if (!accounts[0]) throw new AppError('wallet_disconnected', 'No Ethereum account connected.', true)
      setEthAddress(accounts[0])
      setStatus((current) => (current === 'connected' ? current : 'connected'))
      return accounts[0]
    } catch (err) {
      setError(toErrorMessage(err))
      throw err
    }
  }, [])

  useEffect(() => {
    void connect().catch(() => undefined)
  }, [connect])

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
    ],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext)
  if (!value) throw new Error('useWallet must be used inside WalletProvider')
  return value
}
