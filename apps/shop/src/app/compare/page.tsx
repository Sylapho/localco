import Link from 'next/link'

const variants = [
  {
    href: '/classic',
    title: 'Classic',
    description:
      'Version boutique classique : sobre, lisible, rassurante, proche e-commerce standard.',
  },
  {
    href: '/premium',
    title: 'Premium',
    description:
      'Version plus élégante : grands visuels, typographie boutique, rendu plus haut de gamme.',
  },
  {
    href: '/minimal',
    title: 'Minimal',
    description:
      'Version très simple : moins d’éléments, navigation rapide, priorité aux produits.',
  },
]

export default function CompareShopPage() {
  return (
    <main className="min-h-screen bg-[#fffaf5] px-4 py-10 text-stone-950">
      <section className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-800">
          Comparaison UX
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Versions du shop
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
          Ouvre chaque version dans un onglet différent pour comparer le rendu
          desktop et mobile. Quand une version te plaît, on pourra la remettre
          sur la page principale.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {variants.map((variant) => (
            <Link
              key={variant.href}
              href={variant.href}
              className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <h2 className="text-2xl font-bold">{variant.title}</h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                {variant.description}
              </p>
              <span className="mt-5 inline-flex rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
                Voir la version
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}