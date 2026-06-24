const DEFAULT_PUBLIC_API_URL = 'http://localhost:4000/api'
const PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_PUBLIC_API_URL

function getPublicApiOrigin() {
  try {
    return new URL(PUBLIC_API_URL).origin
  } catch {
    return new URL(DEFAULT_PUBLIC_API_URL).origin
  }
}

export function getImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return null

  const trimmedUrl = imageUrl.trim()

  if (!trimmedUrl) return null

  if (trimmedUrl.startsWith('/uploads/')) {
    return `${getPublicApiOrigin()}${trimmedUrl}`
  }

  try {
    const url = new URL(trimmedUrl)

    if (url.pathname.startsWith('/uploads/')) {
      return `${getPublicApiOrigin()}${url.pathname}${url.search}`
    }
  } catch {
    return trimmedUrl
  }

  return trimmedUrl
}
