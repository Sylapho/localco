import Link from 'next/link'
import type { ReactNode } from 'react'

type LegalPageProps = {
  title: string
  description: string
  children: ReactNode
}

export default function LegalPage({
  title,
  description,
  children,
}: LegalPageProps) {
  return (
    <main className="bg-[#fff8fc]">
      <section className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/" className="text-sm font-semibold text-[#b5006e]">
          Retour à la boutique
        </Link>

        <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#b5006e]">
            Informations légales
          </p>
          <h1 className="mt-2 text-3xl font-bold">{title}</h1>
          <p className="mt-3 text-sm text-zinc-600">{description}</p>
          <p className="mt-2 text-xs text-zinc-500">
            Dernière mise à jour : 29 mai 2026.
          </p>
        </div>

        <div className="mt-6 space-y-6 text-sm leading-6 text-zinc-700">
          {children}
        </div>
      </section>
    </main>
  )
}

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

export function ToComplete({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">
      {children}
    </span>
  )
}
