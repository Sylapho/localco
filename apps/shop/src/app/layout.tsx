import type { Metadata } from 'next'
import ShopFooter from '@/components/shop/shop-footer'
import './globals.css'

export const metadata: Metadata = {
  title: 'Les Cocottes de Diane',
  description: 'Commande en ligne',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <body>
        {children}
        <ShopFooter />
      </body>
    </html>
  )
}
