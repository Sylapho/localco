import type { Metadata } from 'next'
import AppShell from '@/components/layout/app-shell'
import './globals.css'

export const metadata: Metadata = {
  title: 'Les cocottes de Diane',
  description: 'Gestion interne Click & Collect',
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
