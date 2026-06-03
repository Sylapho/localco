import Link from 'next/link'

export default function ShopFooter() {
  return (
    <footer className="border-t bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
        <p>Les Cocottes de Diane - Commande en ligne</p>
        <nav aria-label="Liens légaux" className="flex flex-wrap gap-4">
          <Link href="/mentions-legales" className="hover:text-[#b5006e]">
            Mentions légales
          </Link>
          <Link href="/cgv" className="hover:text-[#b5006e]">
            CGV
          </Link>
          <Link href="/confidentialite" className="hover:text-[#b5006e]">
            Confidentialité
          </Link>
        </nav>
      </div>
    </footer>
  )
}
