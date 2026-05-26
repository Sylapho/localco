import Link from 'next/link'

const quickActions = [
  {
    title: 'Nouvelle vente',
    description: 'Encaisser des articles et mettre a jour le stock.',
    href: '/ventes/new',
    primary: true,
  },
  {
    title: 'Caisse du jour',
    description: 'Suivre les totaux, les paiements et cloturer la journee.',
    href: '/caisse',
    primary: false,
  },
  {
    title: 'Articles',
    description: 'Consulter le catalogue, les prix et les stocks produits.',
    href: '/articles',
    primary: false,
  },
  {
    title: 'Matieres premieres',
    description: 'Surveiller les ingredients, seuils et couts unitaires.',
    href: '/matieres-premieres',
    primary: false,
  },
]

const modules = [
  {
    name: 'Vente',
    status: 'Pret',
    items: ['Creation de ventes', 'Decrement du stock', 'Modes de paiement'],
  },
  {
    name: 'Caisse',
    status: 'Pret',
    items: ['Synthese du jour', 'Cloture', 'Historique'],
  },
  {
    name: 'Production',
    status: 'En cours',
    items: ['Nomenclatures', 'Capacite de production', 'Production articles'],
  },
  {
    name: 'Roles',
    status: 'A implementer',
    items: ['Matrice definie', 'Guards API', 'Menus par role'],
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 p-6 text-zinc-950 sm:p-8">
      <div className="mx-auto grid max-w-6xl gap-8">
        <section className="rounded border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                LocalCo
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                Gestion de stock et caisse
              </h1>
              <p className="mt-3 max-w-2xl text-zinc-600">
                Pilote les ventes, la caisse, les articles et les matieres
                premieres depuis un point d'entree simple.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/ventes/new"
                className="rounded bg-black px-4 py-2 text-white"
              >
                Encaisser
              </Link>
              <Link href="/caisse" className="rounded border px-4 py-2">
                Voir la caisse
              </Link>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Actions rapides</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={`rounded border p-4 shadow-sm transition hover:border-zinc-400 ${
                  action.primary ? 'bg-black text-white' : 'bg-white'
                }`}
              >
                <h3 className="font-semibold">{action.title}</h3>
                <p
                  className={`mt-2 text-sm ${
                    action.primary ? 'text-zinc-300' : 'text-zinc-600'
                  }`}
                >
                  {action.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded border bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Modules</h2>
            <div className="grid gap-3">
              {modules.map((module) => (
                <div
                  key={module.name}
                  className="grid gap-3 rounded border p-4 md:grid-cols-[180px_1fr]"
                >
                  <div>
                    <h3 className="font-semibold">{module.name}</h3>
                    <p className="mt-1 text-sm text-zinc-600">{module.status}</p>
                  </div>
                  <ul className="grid gap-1 text-sm text-zinc-600">
                    {module.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded border bg-white p-4 shadow-sm">
            <h2 className="text-xl font-semibold">Prochaines etapes</h2>
            <ol className="mt-4 grid gap-3 text-sm text-zinc-700">
              <li>1. Proteger les routes API avec les roles.</li>
              <li>2. Ajouter une navigation adaptee au role connecte.</li>
              <li>3. Creer les mouvements de stock.</li>
              <li>4. Ajouter les receptions de matieres premieres.</li>
            </ol>
            <Link
              href="/caisse/journees"
              className="mt-5 inline-block rounded border px-4 py-2 text-sm"
            >
              Historique caisse
            </Link>
          </aside>
        </section>
      </div>
    </main>
  )
}
