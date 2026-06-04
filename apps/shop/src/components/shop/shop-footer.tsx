import Link from 'next/link'

const legalLinks = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/cgv', label: 'CGV' },
  { href: '/confidentialite', label: 'Confidentialité' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/click-and-collect', label: 'Click & Collect' },
]

export default function ShopFooter() {
  return (
    <footer className="border-t border-[#eee2e7] bg-white">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-7 text-sm text-[#7a6d73] sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <p className="font-black text-[#181014]">
            Les Cocottes de Diane - Commande en ligne
          </p>
          <p className="mt-1 max-w-xl leading-6">
            Boutique alimentaire en Click & Collect. Les commandes sont à retirer
            au point choisi lors du paiement, sans livraison à domicile.
          </p>
        </div>

        <nav aria-label="Liens légaux" className="flex flex-wrap gap-3 sm:max-w-sm sm:justify-end">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="font-bold hover:text-[#b5006e]">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
