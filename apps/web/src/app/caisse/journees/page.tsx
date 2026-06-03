import Link from 'next/link'
import { getJourneesCaisse } from '@/lib/api'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeZone: 'Europe/Paris',
  }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date(value))
}

export default async function JourneesCaissePage() {
  const journees = await getJourneesCaisse()
  const totalTTC = journees.reduce((total, journee) => total + journee.totalTTC, 0)
  const totalMarge = journees.reduce((total, journee) => total + journee.marge, 0)
  const totalVentes = journees.reduce(
    (total, journee) => total + journee.nbVentes,
    0,
  )

  return (
    <main className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Historique de caisse</h1>
          <p className="mt-1 text-sm text-gray-600">
            Journées clôturées et totaux conservés.
          </p>
        </div>

        <Link href="/caisse" className="rounded border px-4 py-2">
          Retour à la caisse
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded border p-4">
          <p className="text-sm text-gray-600">Journées clôturées</p>
          <p className="mt-2 text-2xl font-bold">{journees.length}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-sm text-gray-600">Chiffre d&apos;affaires TTC</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(totalTTC)}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-sm text-gray-600">Marge estimée</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(totalMarge)}</p>
        </div>
      </section>

      <section className="mt-6 rounded border p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Journées</h2>
          <p className="text-sm text-gray-600">{totalVentes} vente(s)</p>
        </div>

        {journees.length === 0 ? (
          <div>
            <p className="text-sm text-gray-600">
              Aucune journée de caisse clôturée pour le moment.
            </p>
            <Link
              href="/caisse"
              className="mt-4 inline-block rounded bg-black px-4 py-2 text-white"
            >
              Voir la caisse du jour
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-220 text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Ventes</th>
                  <th className="py-2 pr-3 font-medium">Total TTC</th>
                  <th className="py-2 pr-3 font-medium">Total HT</th>
                  <th className="py-2 pr-3 font-medium">TVA</th>
                  <th className="py-2 pr-3 font-medium">CB</th>
                  <th className="py-2 pr-3 font-medium">Espèces</th>
                  <th className="py-2 pr-3 font-medium">Chèques</th>
                  <th className="py-2 pr-3 font-medium">Marge</th>
                  <th className="py-2 font-medium">Clôturée</th>
                </tr>
              </thead>
              <tbody>
                {journees.map((journee) => (
                  <tr key={journee.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-3 font-medium">
                      {formatDate(journee.date)}
                    </td>
                    <td className="py-3 pr-3">{journee.nbVentes}</td>
                    <td className="py-3 pr-3">
                      {formatCurrency(journee.totalTTC)}
                    </td>
                    <td className="py-3 pr-3">
                      {formatCurrency(journee.totalHT)}
                    </td>
                    <td className="py-3 pr-3">{formatCurrency(journee.tva)}</td>
                    <td className="py-3 pr-3">{formatCurrency(journee.cb)}</td>
                    <td className="py-3 pr-3">
                      {formatCurrency(journee.especes)}
                    </td>
                    <td className="py-3 pr-3">
                      {formatCurrency(journee.cheques)}
                    </td>
                    <td className="py-3 pr-3">
                      {formatCurrency(journee.marge)}
                    </td>
                    <td className="py-3">{formatDateTime(journee.clotureeA)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
