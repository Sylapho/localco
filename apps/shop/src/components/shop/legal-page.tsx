import Link from 'next/link'
import type { ReactNode } from 'react'

type LegalPageProps = {
  title: string
  description: string
  children: ReactNode
}

const legalLinks = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/cgv', label: 'CGV' },
  { href: '/confidentialite', label: 'Confidentialité' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/click-and-collect', label: 'Click & Collect' },
]

export default function LegalPage({
  title,
  description,
  children,
}: LegalPageProps) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffafb_0%,#faf7f8_42%,#f7edf2_100%)]">
      <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <Link
          href="/"
          className="inline-flex rounded-full bg-[#fceef6] px-4 py-2 text-sm font-bold text-[#8c0055] hover:text-[#5a0037]"
        >
          ← Retour à la boutique
        </Link>

        <div className="mt-6 rounded-[1.75rem] border border-[#f0dbe6] bg-white/90 p-6 shadow-sm backdrop-blur sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b5006e]">
            Informations légales
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-[#181014] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#7a6d73]">
            {description}
          </p>
          <p className="mt-3 text-xs font-medium text-[#9b8d94]">
            Dernière mise à jour : 4 juin 2026.
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr] lg:items-start">
          <aside className="rounded-[1.5rem] border border-[#eee2e7] bg-white p-4 shadow-sm lg:sticky lg:top-24">
            <p className="text-xs font-black uppercase tracking-wide text-[#b5006e]">
              À consulter
            </p>
            <nav aria-label="Navigation légale" className="mt-3 grid gap-2">
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-2xl px-3 py-2 text-sm font-bold text-[#4a3d43] transition hover:bg-[#fceef6] hover:text-[#8c0055]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </aside>

          <div className="space-y-5 text-sm leading-6 text-[#4a3d43]">
            {children}
          </div>
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
    <section className="rounded-[1.5rem] border border-[#eee2e7] bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-black text-[#181014]">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

export function LegalNotice({
  title,
  children,
  variant = 'info',
}: {
  title: string
  children: ReactNode
  variant?: 'info' | 'warning' | 'success' | 'danger'
}) {
  const styles = {
    info: 'border-[#dbeafe] bg-blue-50 text-blue-900',
    warning: 'border-[#fde68a] bg-amber-50 text-amber-950',
    success: 'border-[#bbf7d0] bg-green-50 text-green-900',
    danger: 'border-[#fecaca] bg-red-50 text-red-900',
  }[variant]

  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <p className="font-black">{title}</p>
      <div className="mt-1 space-y-2 text-sm leading-6">{children}</div>
    </div>
  )
}

export function ToComplete({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-amber-50 px-1.5 py-0.5 font-bold text-amber-800">
      {children}
    </span>
  )
}
