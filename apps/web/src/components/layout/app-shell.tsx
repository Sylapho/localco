'use client'

import { authClient } from '@/lib/auth-client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

type NavItem = {
  label: string
  href: string
  short: string
  description: string
}

const navItems: NavItem[] = [
  {
    label: 'Accueil',
    href: '/',
    short: 'Home',
    description: 'Vue générale',
  },
  {
    label: 'Caisse',
    href: '/caisse',
    short: 'Caisse',
    description: 'Journée en cours',
  },
  {
    label: 'Ventes',
    href: '/ventes/new',
    short: 'Vente',
    description: 'Encaissement',
  },
  {
    label: 'Commandes',
    href: '/commandes',
    short: 'Cmd',
    description: 'En ligne',
  },
  {
    label: 'Articles',
    href: '/articles',
    short: 'Arts',
    description: 'Catalogue',
  },
  {
    label: 'Stock',
    href: '/stock',
    short: 'Stock',
    description: 'Matières & articles',
  },
  {
    label: 'Historique',
    href: '/caisse/journees',
    short: 'Hist.',
    description: 'Clôtures',
  },
]

const adminNavItem: NavItem = {
  label: 'Admin',
  href: '/admin/users',
  short: 'Admin',
  description: 'Utilisateurs',
}

function isActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/'
  }

  if (href === '/ventes/new') {
    return pathname.startsWith('/ventes')
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const user = session?.user
  const role = user?.role
  const isSignedIn = Boolean(session)
  const isLoaded = !isPending
  const visibleNavItems =
    role === 'gerant' ? [...navItems, adminNavItem] : navItems

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/')
          router.refresh()
        },
      },
    })
  }

  return (
    <div className="lc-shell">
      <aside className="lc-sidebar">
        <Link href="/" className="lc-brand" aria-label="LocalCo accueil">
          <span className="lc-brand-kicker">Local</span>
          <strong>Co</strong>
          <small>Gestion stock & caisse</small>
        </Link>

        <nav className="lc-nav" aria-label="Navigation principale">
          {visibleNavItems.map((item) => {
            const active = isActive(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? 'lc-nav-item active' : 'lc-nav-item'}
              >
                <span className="lc-nav-mark" aria-hidden="true">
                  {item.short.slice(0, 2)}
                </span>
                <span>
                  <span className="lc-nav-label">{item.label}</span>
                  <span className="lc-nav-desc">{item.description}</span>
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="lc-sidebar-foot">
          {isLoaded && isSignedIn ? (
            <div className="lc-user-chip">
              <button
                type="button"
                onClick={handleSignOut}
                className="lc-avatar"
                title="Se déconnecter"
              >
                {user?.name?.slice(0, 2).toUpperCase() ?? 'LC'}
              </button>
              <span>
                <strong>{user?.name ?? 'Compte'}</strong>
                <small>Rôle : {typeof role === 'string' ? role : 'vendeur'}</small>
              </span>
            </div>
          ) : null}

          {isLoaded && !isSignedIn ? (
            <div className="lc-auth-actions">
              <Link href="/sign-in" className="lc-auth-primary">
                Se connecter
              </Link>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="lc-workspace">
        <div className="lc-topbar">
          <div>
            <strong>LocalCo</strong>
            {isLoaded && isSignedIn ? (
              <span>Interface de gestion</span>
            ) : null}
            {isLoaded && !isSignedIn ? (
              <span>Connecte-toi pour accéder à la gestion</span>
            ) : null}
          </div>
          {isLoaded && isSignedIn ? (
            <Link href="/ventes/new" className="lc-topbar-action">
              Nouvelle vente
            </Link>
          ) : null}
          {isLoaded && !isSignedIn ? (
            <div className="lc-topbar-auth">
              <Link href="/sign-in" className="lc-topbar-action">
                Connexion
              </Link>
            </div>
          ) : null}
        </div>

        <div className="lc-content">{children}</div>
      </div>

      <nav className="lc-bottom-nav" aria-label="Navigation mobile">
        {navItems.slice(0, 5).map((item) => {
          const active = isActive(pathname, item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? 'active' : undefined}
            >
              <span>{item.short}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
