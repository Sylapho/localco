import type { Metadata } from 'next'
import AppShell from '@/components/layout/app-shell'
import './globals.css'

export const metadata: Metadata = {
  title: 'LOCAL CO',
  description: 'Gestion commerce de proximité',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
