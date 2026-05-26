'use client'

export function useAuthenticatedFetch() {
  return async function authenticatedFetch(
    input: RequestInfo | URL,
    init: RequestInit = {},
  ) {
    const headers = new Headers(init.headers)

    return fetch(input, {
      ...init,
      headers,
      credentials: 'include',
    })
  }
}
