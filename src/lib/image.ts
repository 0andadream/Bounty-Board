const SIZE = 512
const MAX_CHARS = 220_000

export async function readProfileImage(file: File): Promise<string> {
  return compressImage(file, 256, 140_000)
}

export async function readCoverImage(file: File): Promise<string> {
  return compressWideImage(file, 960, 240, 220_000)
}

export async function readBountyImage(file: File): Promise<string> {
  return compressImage(file, SIZE, MAX_CHARS)
}

async function compressImage(file: File, size: number, maxChars: number): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Pick an image file.')
  }

  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read that image.')

  const scale = Math.max(size / bitmap.width, size / bitmap.height)
  const width = bitmap.width * scale
  const height = bitmap.height * scale
  ctx.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height)

  let quality = 0.84
  let data = canvas.toDataURL('image/jpeg', quality)
  while (data.length > maxChars && quality > 0.4) {
    quality -= 0.08
    data = canvas.toDataURL('image/jpeg', quality)
  }
  if (data.length > 280_000) {
    throw new Error('Image is too large. Try a smaller photo.')
  }
  return data
}

async function compressWideImage(file: File, width: number, height: number, maxChars: number): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Pick an image file.')
  }
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read that image.')
  const scale = Math.max(width / bitmap.width, height / bitmap.height)
  const drawW = bitmap.width * scale
  const drawH = bitmap.height * scale
  ctx.drawImage(bitmap, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH)
  let quality = 0.82
  let data = canvas.toDataURL('image/jpeg', quality)
  while (data.length > maxChars && quality > 0.4) {
    quality -= 0.08
    data = canvas.toDataURL('image/jpeg', quality)
  }
  if (data.length > 280_000) {
    throw new Error('Image is too large. Try a smaller photo.')
  }
  return data
}
