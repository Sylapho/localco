import Link from 'next/link'
import { getVentes } from '@/lib/api'

const modeLabels = {
  cb: 'Carte bancaire',
  especes: 'Especes',
  cheque: 'Cheque',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default async function VentesPage() {
  const ventes = await getVentes()

  const totalTTC = ventes.reduce((total, vente) => total + vente.totalTTC, 0)

  return (
    <main className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ventes</h1>
          <p className="mt-1 text-sm text-gray-600">
            {ventes.length} vente(s) - {formatCurrency(totalTTC)} TTC
          </p>
        </div>

        <Link href="/ventes/new" className="rounded bg-black px-4 py-2 text-white">
          Nouvelle vente
        </Link>
      </div>

      {ventes.length === 0 ? (
        <p>Aucune vente enregistree.</p>
      ) : (
        <ul className="grid gap-4">
          {ventes.map((vente) => (
            <li key={vente.id} className="rounded border p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Vente #{vente.id}</h2>
                  <p className="text-sm text-gray-600">{formatDate(vente.date)}</p>
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold">
                    {formatCurrency(vente.totalTTC)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {modeLabels[vente.mode]}
                  </p>
                </div>
              </div>

              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-gray-600">Total HT</dt>
                  <dd className="font-medium">{formatCurrency(vente.totalHT)}</dd>
                </div>
                <div>
                  <dt className="text-gray-600">TVA</dt>
                  <dd className="font-medium">{formatCurrency(vente.tva)}</dd>
                </div>
                <div>
                  <dt className="text-gray-600">Remise</dt>
                  <dd className="font-medium">{formatCurrency(vente.remise)}</dd>
                </div>
              </dl>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-130 text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-3 font-medium">Article</th>
                      <th className="py-2 pr-3 font-medium">Quantite</th>
                      <th className="py-2 pr-3 font-medium">Prix unit.</th>
                      <th className="py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vente.lignes.map((ligne) => (
                      <tr key={ligne.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-3">
                          <span className="mr-2">{ligne.article.emoji}</span>
                          {ligne.article.nom}
                        </td>
                        <td className="py-2 pr-3">{ligne.quantite}</td>
                        <td className="py-2 pr-3">
                          {formatCurrency(ligne.prixUnit)}
                        </td>
                        <td className="py-2">
                          {formatCurrency(ligne.prixUnit * ligne.quantite)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
