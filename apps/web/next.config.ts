import type { NextConfig } from 'next'

const apiUrl = new URL(
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api',
)

function getApiImageRemotePattern() {
  return {
    protocol: apiUrl.protocol.replace(':', '') as 'http' | 'https',
    hostname: apiUrl.hostname,
    port: apiUrl.port,
    pathname: '/uploads/**',
  }
}

function isLocalApiHost() {
  return ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(
    apiUrl.hostname,
  )
}

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    dangerouslyAllowLocalIP: isLocalApiHost(),
    remotePatterns: [getApiImageRemotePattern()],
  },
}

export default nextConfig
