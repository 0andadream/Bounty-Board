import { formatNimiqAddress, shortenWallet } from '@shared/address.ts'
import { minorToDisplay } from '@shared/money.ts'
import type { Token } from '@shared/types.ts'

export function money(amountMinor: bigint | string, token: Token): string {
  return `${minorToDisplay(amountMinor, token)} ${token}`
}

export function formatWallet(token: Token, value: string): string {
  return token === 'NIM' ? formatNimiqAddress(value) : value
}

export function shortWallet(token: Token, value: string): string {
  return shortenWallet(token, value)
}

export function formatWhen(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(ts)
}

export function formatDeadline(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(ts)
}

export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const node = document.createElement('textarea')
  node.value = value
  node.setAttribute('readonly', '')
  node.style.position = 'fixed'
  node.style.opacity = '0'
  document.body.appendChild(node)
  node.select()
  document.execCommand('copy')
  document.body.removeChild(node)
}

export function publicOrigin(): string {
  const configured = (import.meta.env.VITE_APP_URL ?? '').replace(/\/$/, '')
  if (configured) return configured
  return window.location.origin
}

export function receiptUrl(id: string): string {
  return `${publicOrigin()}/b/${id}/receipt`
}

export function explorerUrl(token: Token, txHash: string): string | null {
  if (token === 'USDT' && txHash.startsWith('0x')) {
    return `https://polygonscan.com/tx/${txHash}`
  }
  if (/^[0-9a-fA-F]{64}$/.test(txHash)) {
    return `https://v2.nimiqwatch.com/tx/${txHash}`
  }
  return null
}
