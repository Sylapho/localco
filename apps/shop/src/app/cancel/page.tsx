import Link from 'next/link'

export default function CancelPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffafb_0%,#faf7f8_42%,#f7edf2_100%)] px-4 py-6 sm:py-10">
      <section className="mx-auto grid min-h-[70vh] max-w-5xl place-items-center">
        <div className="grid gap-6 rounded-[1.75rem] border border-[#eee2e7] bg-white p-5 shadow-sm sm:p-7 lg:grid-cols-[1fr_340px] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b5006e]">
              Paiement annulé
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-[#181014] sm:text-5xl">
              Votre commande n’est pas finalisée
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#7a6d73] sm:text-base sm:leading-7">
              Aucun paiement n’a été confirmé. Votre panier reste disponible si
              vous revenez sur le même appareil et vous pouvez reprendre le
              parcours quand vous le souhaitez.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/checkout"
                className="rounded-full bg-[#b5006e] px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-[#8c0055]"
              >
                Reprendre le paiement
              </Link>
              <Link
                href="/"
                className="rounded-full border border-[#e8e1e4] bg-white px-5 py-3 text-center text-sm font-black text-[#5a0037] transition hover:border-[#b5006e]"
              >
                Retour à la boutique
              </Link>
            </div>
          </div>

          <aside className="rounded-[1.5rem] bg-[#fceef6] p-5">
            <p className="text-sm font-black uppercase tracking-wide text-[#8c0055]">
              Que faire ensuite ?
            </p>
            <ol className="mt-4 grid gap-3">
              <CancelStep
                title="Vérifier le panier"
                text="Vos produits peuvent encore être ajustés avant paiement."
              />
              <CancelStep
                title="Relancer le paiement"
                text="Reprenez le checkout pour choisir votre retrait et valider."
              />
              <CancelStep
                title="Aucun débit confirmé"
                text="La commande ne part en préparation qu’après validation du paiement."
              />
            </ol>
          </aside>
        </div>
      </section>
    </main>
  )
}

function CancelStep({ title, text }: { title: string; text: string }) {
  return (
    <li className="rounded-2xl bg-white/75 p-4">
      <p className="font-black text-[#181014]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[#7a6d73]">{text}</p>
    </li>
  )
}
