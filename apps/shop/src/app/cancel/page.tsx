import Link from 'next/link'

export default function CancelPage() {
  return (
    <main className="min-h-screen bg-[#fff8fc]">

      <section className="mx-auto grid min-h-screen max-w-xl place-items-center px-4 py-10 text-center">
        <div className="rounded-lg border bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#b5006e]">
            Paiement annule
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            Votre commande n&apos;est pas finalisee.
          </h1>
          <p className="mt-3 text-sm text-zinc-600">
            Aucun paiement n&apos;a ete confirme. Vous pouvez retourner a la
            boutique et relancer votre commande.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="rounded bg-[#b5006e] px-4 py-2 font-semibold text-white"
            >
              Revenir a la boutique
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
