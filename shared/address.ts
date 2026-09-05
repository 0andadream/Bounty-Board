const NIM_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVXY'

function ibanCheck(value: string): number {
  const numbered = value
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0)
      return code >= 65 ? String(code - 55) : char
    })
    .join('')

  let tmp = ''
  for (let i = 0; i < Math.ceil(numbered.length / 6); i += 1) {
    tmp = String(Number(tmp + numbered.substr(i * 6, 6)) % 97)
  }
  return Number(tmp)
}

export function normalizeNimiqAddress(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase()
}

export function formatNimiqAddress(input: string): string {
  const compact = normalizeNimiqAddress(input)
  return compact.replace(/(.{4})/g, '$1 ').trim()
}

export function isValidNimiqAddress(input: string): boolean {
  const compact = normalizeNimiqAddress(input)
  if (!/^NQ\d{2}[0-9A-Z]{32}$/.test(compact)) return false
  const payload = compact.slice(4)
  if ([...payload].some((char) => !NIM_ALPHABET.includes(char))) return false
  return ibanCheck(`${payload}NQ${compact.slice(2, 4)}`) === 1
}

export function shortenNimiqAddress(input: string): string {
  const formatted = formatNimiqAddress(input)
  if (formatted.length < 12) return formatted
  return `${formatted.slice(0, 11)}…${formatted.slice(-4)}`
}

export function normalizeEthAddress(input: string): string {
  return input.trim().toLowerCase()
}

export function isValidEthAddress(input: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(input.trim())
}

export function shortenEthAddress(input: string): string {
  const value = input.trim()
  if (value.length < 12) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

export function sameAddress(a: string, b: string): boolean {
  return a.replace(/\s+/g, '').toLowerCase() === b.replace(/\s+/g, '').toLowerCase()
}

export function normalizeWallet(token: 'NIM' | 'USDT', input: string): string {
  if (token === 'NIM') return formatNimiqAddress(input)
  return normalizeEthAddress(input)
}

export function isValidWallet(token: 'NIM' | 'USDT', input: string): boolean {
  return token === 'NIM' ? isValidNimiqAddress(input) : isValidEthAddress(input)
}

export function shortenWallet(token: 'NIM' | 'USDT', input: string): string {
  return token === 'NIM' ? shortenNimiqAddress(input) : shortenEthAddress(input)
}
