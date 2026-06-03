import Link from 'next/link'
import ArticleImage from '@/components/articles/article-image'
import CloseCaisseButton from '@/components/caisse/close-caisse-button'
import {
  getCaisseToday,
  getVentes,
  type Vente,
  type VenteMode,
} from '@/lib/api'

const modeLabels: Record<VenteMode, string> = {
  cb: 'Carte bancaire',
  especes: 'Espèces',
  cheque: 'Chèque',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date(value))
}

function getDayKey(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(new Date(value))
}

function getTopArticles(ventes: Vente[]) {
  const articles = new Map<
    number,
    {
      nom: string
      imageUrl?: string | null
      quantite: number
      totalTTC: number
    }
  >()

  for (const vente of ventes) {
    for (const ligne of vente.lignes) {
      const current = articles.get(ligne.articleId) ?? {
        nom: ligne.article.nom,
        imageUrl: ligne.article.imageUrl,
        quantite: 0,
        totalTTC: 0,
      }

      articles.set(ligne.articleId, {
        ...current,
        quantite: current.quantite + ligne.quantite,
        totalTTC: current.totalTTC + ligne.prixUnit * ligne.quantite,
      })
    }
  }

  return Array.from(articles.values())
    .sort((a, b) => b.totalTTC - a.totalTTC)
    .slice(0, 5)
}

export default async function CaissePage() {
  const [caisse, ventes] = await Promise.all([getCaisseToday(), getVentes()])
  const ventesDuJour = ventes.filter(
    (vente) => getDayKey(vente.date) === caisse.dayKey,
  )
  const totalsByMode: Record<VenteMode, number> = {
    cb: caisse.totals.cb,
    especes: caisse.totals.especes,
    cheque: caisse.totals.cheques,
  }
  const topArticles = getTopArticles(ventesDuJour)

  const totalTTC = caisse.totals.totalTTC
  const totalHT = caisse.totals.totalHT
  const totalTVA = caisse.totals.tva
  const totalRemise = ventesDuJour.reduce(
    (total, vente) => total + vente.remise,
    0,
  )
  const nbArticles = ventesDuJour.reduce(
    (total, vente) =>
      total +
      vente.lignes.reduce((lineTotal, ligne) => lineTotal + ligne.quantite, 0),
    0,
  )
  const panierMoyen =
    caisse.totals.nbVentes > 0 ? totalTTC / caisse.totals.nbVentes : 0

  return (
    <main className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Caisse du jour</h1>
          <p className="mt-1 text-sm text-gray-600">
            Synthèse des ventes du {caisse.dayKey}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/ventes" className="rounded border px-4 py-2">
            Voir les ventes
          </Link>
          <Link href="/ventes/new" className="rounded bg-black px-4 py-2 text-white">
            Nouvelle vente
          </Link>
        </div>
      </div>

      <section className="mb-6 rounded border p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-600">État de la caisse</p>
            {caisse.status === 'closed' ? (
              <p className="mt-1 font-semibold">
                Journée clôturée
                {caisse.closedDay
                  ? ` le ${formatDateTime(caisse.closedDay.clotureeA)}`
                  : ''}
              </p>
            ) : (
              <p className="mt-1 font-semibold">Journée ouverte</p>
            )}
          </div>

          <CloseCaisseButton disabled={caisse.status === 'closed'} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded border p-4">
          <p className="text-sm text-gray-600">Total TTC</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(totalTTC)}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-sm text-gray-600">Nombre de ventes</p>
          <p className="mt-2 text-2xl font-bold">{caisse.totals.nbVentes}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-sm text-gray-600">Panier moyen</p>
          <p className="mt-2 text-2xl font-bold">
            {formatCurrency(panierMoyen)}
          </p>
        </div>
        <div className="rounded border p-4">
          <p className="text-sm text-gray-600">Articles vendus</p>
          <p className="mt-2 text-2xl font-bold">{nbArticles}</p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded border p-4">
          <h2 className="mb-4 text-lg font-semibold">Encaissements</h2>
          <dl className="grid gap-3">
            {Object.entries(totalsByMode).map(([mode, total]) => (
              <div key={mode} className="flex justify-between gap-4">
                <dt>{modeLabels[mode as VenteMode]}</dt>
                <dd className="font-medium">{formatCurrency(total)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded border p-4">
          <h2 className="mb-4 text-lg font-semibold">Totaux comptables</h2>
          <dl className="grid gap-3">
            <div className="flex justify-between gap-4">
              <dt>Total HT</dt>
              <dd className="font-medium">{formatCurrency(totalHT)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>TVA</dt>
              <dd className="font-medium">{formatCurrency(totalTVA)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Remises</dt>
              <dd className="font-medium">{formatCurrency(totalRemise)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Marge estimée</dt>
              <dd className="font-medium">
                {formatCurrency(caisse.totals.marge)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded border p-4">
          <h2 className="mb-4 text-lg font-semibold">Top articles</h2>

          {topArticles.length === 0 ? (
            <p className="text-sm text-gray-600">
              Aucun article vendu aujourd&apos;hui.
            </p>
          ) : (
            <ul className="grid gap-3">
              {topArticles.map((article) => (
                <li
                  key={article.nom}
                  className="flex items-center justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">
                      <span className="flex items-center gap-2">
                        <ArticleImage
                          article={article}
                          className="h-8 w-8 overflow-hidden rounded border bg-gray-100"
                        />
                        <span>{article.nom}</span>
                      </span>
                    </p>
                    <p className="text-sm text-gray-600">
                      {article.quantite} vendu(s)
                    </p>
                  </div>
                  <p className="font-medium">{formatCurrency(article.totalTTC)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded border p-4">
          <h2 className="mb-4 text-lg font-semibold">Dernieres ventes</h2>

          {ventesDuJour.length === 0 ? (
            <div>
              <p className="text-sm text-gray-600">
                Aucune vente enregistrée aujourd&apos;hui.
              </p>
              <Link
                href="/ventes/new"
                className="mt-4 inline-block rounded bg-black px-4 py-2 text-white"
              >
                Enregistrer une vente
              </Link>
            </div>
          ) : (
            <ul className="grid gap-3">
              {ventesDuJour.slice(0, 6).map((vente) => (
                <li
                  key={vente.id}
                  className="flex items-center justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">Vente #{vente.id}</p>
                    <p className="text-sm text-gray-600">
                      {formatDateTime(vente.date)} - {modeLabels[vente.mode]}
                    </p>
                  </div>
                  <p className="font-medium">{formatCurrency(vente.totalTTC)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  )
}
