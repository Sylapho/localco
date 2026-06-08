'use client'

export function useSessionFetch() {
  return async function sessionFetch(
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
