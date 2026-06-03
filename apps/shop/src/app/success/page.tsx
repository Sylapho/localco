import Link from 'next/link'

export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-[#fff8fc]">

      <section className="mx-auto grid min-h-screen max-w-xl place-items-center px-4 py-10 text-center">
        <div className="rounded-lg border bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#b5006e]">
            Paiement confirmé
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            Merci, votre commande est validée.
          </h1>
          <p className="mt-3 text-sm text-zinc-600">
            Nous avons bien reçu votre paiement. Votre commande apparaît
            maintenant dans le suivi de préparation.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="rounded bg-[#b5006e] px-4 py-2 font-semibold text-white"
            >
              Revenir à la boutique
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
