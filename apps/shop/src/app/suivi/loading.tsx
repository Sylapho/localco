export default function SuiviLoading() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffafb_0%,#faf7f8_42%,#f7edf2_100%)] px-4 py-6 sm:py-10">
      <section className="mx-auto grid min-h-[70vh] w-full max-w-2xl place-items-center text-center">
        <div className="rounded-[1.75rem] border border-[#eee2e7] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b5006e]">
            Suivi de commande
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-[#181014]">
            Chargement du suivi
          </h1>
          <p className="mt-4 text-sm leading-6 text-[#7a6d73]">
            Nous récupérons les informations de votre commande.
          </p>
        </div>
      </section>
    </main>
  )
}
