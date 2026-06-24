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
    description: 'Encaissement rapide',
    canAccess: canCreateSales,
  },
  {
    label: 'Commandes',
    href: '/commandes',
    short: 'Cmd',
    description: 'Click & Collect',
    canAccess: canViewOrders,
  },
  {
    label: 'Préparation',
    href: '/preparation',
    short: 'Prep',
    description: 'Retraits à servir',
    canAccess: canViewOrders,
  },
  {
    label: 'Articles',
    href: '/articles',
    short: 'Arts',
    description: 'Catalogue boutique',
    canAccess: canViewArticles,
  },
  {
    label: 'Stock',
    href: '/stock',
    short: 'Stock',
    description: 'Lots, DLC et alertes',
    canAccess: canViewStock,
  },
  {
    label: 'Historique',
    href: '/caisse/journees',
    short: 'Hist.',
    description: 'Clôtures de caisse',
    canAccess: canManageCashRegister,
  },
]

const adminNavItems: NavItem[] = [
  {
    label: 'Utilisateurs',
    href: '/admin/users',
    short: 'Admin',
    description: 'Rôles et accès',
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
    description: 'Paiements à vérifier',
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

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href)

  return (
    <Link
      href={item.href}
      className={active ? 'lc-nav-item active' : 'lc-nav-item'}
      aria-current={active ? 'page' : undefined}
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
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const user = session?.user
  const role = getUserRole(user)
  const hasSession = Boolean(session)
  const isLoaded = !isPending
  const visibleNavItems = navItems.filter((item) => item.canAccess(user))
  const visibleAdminNavItems = adminNavItems.filter((item) =>
    item.canAccess(user),
  )
  const visibleMobileNavItems = visibleNavItems.slice(0, 5)

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
          <span className="lc-brand-kicker">Back-office</span>
          <strong>Les cocottes de Diane</strong>
          <small>Commandes, stock, caisse et production</small>
        </Link>

        <nav className="lc-nav" aria-label="Navigation principale">
          <p className="lc-nav-section">Pilotage</p>
          {visibleNavItems.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}

          {visibleAdminNavItems.length > 0 ? (
            <>
              <p className="lc-nav-section">Administration</p>
              {visibleAdminNavItems.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </>
          ) : null}
        </nav>

        <div className="lc-sidebar-foot">
          {isLoaded && hasSession ? (
            <div className="lc-user-chip">
              <button
                type="button"
                onClick={handleSignOut}
                className="lc-avatar"
                title="Se déconnecter"
                aria-label="Se déconnecter"
              >
                {user?.name?.slice(0, 2).toUpperCase() ?? 'LD'}
              </button>
              <span>
                <strong>{user?.name ?? 'Compte équipe'}</strong>
                <small>Rôle : {role}</small>
              </span>
            </div>
          ) : null}

          {isLoaded && !hasSession ? (
            <Link href="/sign-in" className="lc-auth-primary">
              Se connecter
            </Link>
          ) : null}
        </div>
      </aside>

      <div className="lc-workspace">
        <header className="lc-topbar">
          <div>
            <strong>Interface de gestion</strong>
            {isLoaded && hasSession ? (
              <span>Connecté au back-office Les cocottes de Diane</span>
            ) : null}
            {isLoaded && !hasSession ? (
              <span>Connecte-toi pour accéder aux opérations internes</span>
            ) : null}
          </div>
          {isLoaded && hasSession && canCreateSales(user) ? (
            <Link href="/ventes/new" className="lc-topbar-action">
              Nouvelle vente
            </Link>
          ) : null}
        </header>

        <div className="lc-content">{children}</div>

        <nav className="lc-mobile-nav" aria-label="Navigation mobile">
          {visibleMobileNavItems.map((item) => {
            const active = isActive(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? 'active' : undefined}
                aria-current={active ? 'page' : undefined}
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