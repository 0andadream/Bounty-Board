import type { Token } from './types.ts'

export const DECIMALS: Record<Token, number> = {
  NIM: 5,
  USDT: 6,
}

export function parseToMinor(input: string, token: Token): bigint {
  const decimals = DECIMALS[token]
  const trimmed = input.trim().replace(/,/g, '')
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('Enter a valid amount')
  }
  const [wholeRaw, fracRaw = ''] = trimmed.split('.')
  if (fracRaw.length > decimals) {
    throw new Error(
      token === 'NIM' ? 'NIM supports up to 5 decimal places' : 'USDT supports up to 6 decimal places',
    )
  }
  const whole = BigInt(wholeRaw)
  const frac = BigInt(fracRaw.padEnd(decimals, '0') || '0')
  const base = 10n ** BigInt(decimals)
  return whole * base + frac
}

export function minorToDisplay(minor: bigint | string, token: Token, fractionDigits = 2): string {
  const value = typeof minor === 'string' ? BigInt(minor) : minor
  const decimals = DECIMALS[token]
  const negative = value < 0n
  const abs = negative ? -value : value
  const base = 10n ** BigInt(decimals)
  const whole = abs / base
  const frac = abs % base
  const fracStr = frac.toString().padStart(decimals, '0')
  const shown = fracStr.slice(0, fractionDigits).padEnd(fractionDigits, '0')
  return `${negative ? '-' : ''}${whole.toString()}.${shown}`
}

export function lunaFromNimMinor(minor: bigint | string): number {
  const value = typeof minor === 'string' ? BigInt(minor) : minor
  if (value <= 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('NIM amount is out of range')
  }
  return Number(value)
}

export function paymentMemo(bountyId: string): string {
  return `BOUNTY:${bountyId}:PAID`
}
