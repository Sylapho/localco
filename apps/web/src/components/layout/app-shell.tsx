'use client'

import { authClient } from '@/lib/auth-client'
import {
  canAccessAdmin,
  canCreateSales,
  canManageCashRegister,
  canViewArticles,
  canViewCashRegister,
  canViewOrders,
  canViewStock,
  getUserRole,
  type UserWithRole,
} from '@/lib/permissions'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

type NavItem = {
  label: string
  href: string
  short: string
  description: string
  canAccess: (user: UserWithRole) => boolean
}

const navItems: NavItem[] = [
  {
    label: 'Accueil',
    href: '/',
    short: 'Home',
    description: 'Vue générale',
    canAccess: () => true,
  },
  {
    label: 'Caisse',
    href: '/caisse',
    short: 'Caisse',
    description: 'Journée en cours',
    canAccess: canViewCashRegister,
  },
  {
    label: 'Ventes',
    href: '/ventes/new',
    short: 'Vente',
    description: 'Encaissement',
    canAccess: canCreateSales,
  },
  {
    label: 'Commandes',
    href: '/commandes',
    short: 'Cmd',
    description: 'En ligne',
    canAccess: canViewOrders,
  },
  {
    label: 'Préparation',
    href: '/preparation',
    short: 'Prep',
    description: 'Retraits du jour',
    canAccess: canViewOrders,
  },
  {
    label: 'Articles',
    href: '/articles',
    short: 'Arts',
    description: 'Catalogue',
    canAccess: canViewArticles,
  },
  {
    label: 'Stock',
    href: '/stock',
    short: 'Stock',
    description: 'Matières & articles',
    canAccess: canViewStock,
  },
  {
    label: 'Historique',
    href: '/caisse/journees',
    short: 'Hist.',
    description: 'Clôtures',
    canAccess: canManageCashRegister,
  },
]

const adminNavItems: NavItem[] = [
  {
    label: 'Admin',
    href: '/admin/users',
    short: 'Admin',
    description: 'Utilisateurs',
    canAccess: canAccessAdmin,
  },
  {
    label: 'Retraits',
    href: '/admin/pickup-points',
    short: 'Lieu',
    description: 'Points de retrait',
    canAccess: canAccessAdmin,
  },
  {
    label: 'Stripe',
    href: '/admin/stripe-reconciliations',
    short: 'Pay',
    description: 'Réconciliations',
    canAccess: canAccessAdmin,
  },
]

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
  const role = getUserRole(user)
  const hasSession = Boolean(session)
  const isLoaded = !isPending
  const visibleNavItems = [...navItems, ...adminNavItems].filter((item) =>
    item.canAccess(user),
  )
  const visibleMobileNavItems = navItems
    .filter((item) => item.canAccess(user))
    .slice(0, 5)

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
        <Link href="/" className="lc-brand" aria-label="Les cocottes de Diane accueil">
          <span className="lc-brand-kicker">Les cocottes</span>
          <strong>de Diane</strong>
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
          {isLoaded && hasSession ? (
            <div className="lc-user-chip">
              <button
                type="button"
                onClick={handleSignOut}
                className="lc-avatar"
                title="Se déconnecter"
              >
                {user?.name?.slice(0, 2).toUpperCase() ?? 'LD'}
              </button>
              <span>
                <strong>{user?.name ?? 'Compte'}</strong>
                <small>Rôle : {role}</small>
              </span>
            </div>
          ) : null}

          {isLoaded && !hasSession ? (
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
            <strong>Les cocottes de Diane</strong>
            {isLoaded && hasSession ? <span>Interface de gestion</span> : null}
            {isLoaded && !hasSession ? (
              <span>Connecte-toi pour accéder à la gestion</span>
            ) : null}
          </div>
          {isLoaded && hasSession && canCreateSales(user) ? (
            <Link href="/ventes/new" className="lc-topbar-action">
              Nouvelle vente
            </Link>
          ) : null}
        </div>

        <main>{children}</main>

        <nav className="lc-mobile-nav" aria-label="Navigation mobile">
          {visibleMobileNavItems.map((item) => {
            const active = isActive(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? 'active' : undefined}
              >
                <span>{item.short.slice(0, 2)}</span>
                <small>{item.short}</small>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
