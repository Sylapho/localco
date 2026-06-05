export default function SuccessLoading() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffafb_0%,#faf7f8_42%,#f7edf2_100%)] px-4 py-6 sm:py-10">
      <section className="mx-auto grid min-h-[70vh] max-w-2xl place-items-center text-center">
        <div className="w-full rounded-[1.75rem] border border-[#eee2e7] bg-white p-6 shadow-sm sm:p-8">
          <div className="mx-auto h-3 w-36 rounded-full bg-[#fceef6]" />
          <div className="mx-auto mt-5 h-10 w-72 max-w-full rounded-full bg-[#faf7f8]" />
          <div className="mx-auto mt-4 h-4 w-96 max-w-full rounded-full bg-[#faf7f8]" />
          <p className="mt-6 text-sm font-bold text-[#7a6d73]">
            Chargement des détails de votre commande...
          </p>
        </div>
      </section>
    </main>
  )
}
