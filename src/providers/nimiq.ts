import { getHostLanguage, init, type NimiqProvider } from '@nimiq/mini-app-sdk'
import type { ErrorResponse } from '@nimiq/mini-app-sdk'
import { formatNimiqAddress, isValidNimiqAddress } from '@shared/address.ts'
import { paymentMemo } from '@shared/money.ts'
import { AppError, classifyWalletError } from '../lib/errors.ts'

let providerPromise: Promise<NimiqProvider> | null = null

function isErrorResponse(value: unknown): value is ErrorResponse {
  return Boolean(value && typeof value === 'object' && 'error' in value)
}

export function extractProviderError(value: unknown): string | null {
  if (isErrorResponse(value)) {
    return value.error.message || value.error.type || 'Wallet request failed'
  }
  return null
}

export function hostLanguage(): string {
  return getHostLanguage() ?? navigator.language.split('-')[0] ?? 'en'
}

export function shouldUseMiniApp(): boolean {
  return Boolean(window.nimiq || window.nimiqPay)
}

export async function getNimiqProvider(): Promise<NimiqProvider> {
  if (!providerPromise) {
    providerPromise = init({ timeout: 10_000 })
  }
  try {
    return await providerPromise
  } catch (error) {
    providerPromise = null
    throw classifyWalletError(error)
  }
}

export async function listNimiqAccounts(): Promise<string[]> {
  const nimiq = await getNimiqProvider()
  const result = await nimiq.listAccounts()
  const message = extractProviderError(result)
  if (message) throw new AppError('wallet_disconnected', message, true)
  if (!Array.isArray(result) || result.length === 0) {
    throw new AppError('wallet_disconnected', 'No Nimiq account is available in this wallet.', true)
  }
  return result.filter((address) => isValidNimiqAddress(address)).map(formatNimiqAddress)
}

export async function readNimiqNetwork(): Promise<{ consensus: boolean; blockNumber: number }> {
  const nimiq = await getNimiqProvider()
  const [consensus, blockNumber] = await Promise.all([
    nimiq.isConsensusEstablished(),
    nimiq.getBlockNumber(),
  ])
  return {
    consensus: consensus === true,
    blockNumber: typeof blockNumber === 'number' ? blockNumber : 0,
  }
}

function extractTxHash(result: unknown): string | null {
  const error = extractProviderError(result)
  if (error) return null
  if (typeof result === 'string' && result.trim()) return result.trim()
  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>
    if (typeof record.hash === 'string' && record.hash.trim()) return record.hash.trim()
  }
  return null
}

export async function sendMiniAppPayment(input: {
  recipient: string
  valueLuna: number
  bountyId: string
}): Promise<string> {
  if (!Number.isInteger(input.valueLuna) || input.valueLuna <= 0) {
    throw new AppError('bad_request', 'Invalid NIM amount.', false)
  }

  const nimiq = await getNimiqProvider()
  const recipient = formatNimiqAddress(input.recipient)
  const data = paymentMemo(input.bountyId)

  try {
    const consensus = await nimiq.isConsensusEstablished()
    if (consensus === false) {
      throw new AppError(
        'tx_pending',
        'Nimiq Pay is still connecting to the network. Wait a moment and retry.',
        true,
      )
    }

    const height = await nimiq.getBlockNumber()
    const result = await nimiq.sendBasicTransactionWithData({
      recipient,
      value: input.valueLuna,
      data,
      validityStartHeight: typeof height === 'number' ? height : undefined,
    })

    const error = extractProviderError(result)
    if (error) throw classifyWalletError(new Error(error))

    const txHash = extractTxHash(result)
    if (!txHash) {
      throw new AppError(
        'tx_failed',
        'The wallet did not return a transaction hash. The bounty was not marked paid.',
        true,
      )
    }
    return txHash
  } catch (error) {
    if (error instanceof AppError) throw error
    throw classifyWalletError(error)
  }
}

export function nimiqExplorerUrl(txHash: string): string | null {
  if (/^[0-9a-fA-F]{64}$/.test(txHash)) {
    return `https://v2.nimiqwatch.com/tx/${txHash}`
  }
  return null
}
