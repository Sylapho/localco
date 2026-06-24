import Link from 'next/link'
import type { ReactNode } from 'react'

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

type PageProps = {
  children: ReactNode
  className?: string
}

export function Page({ children, className }: PageProps) {
  return <main className={cx('lc-page', className)}>{children}</main>
}

type PageHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <section className="lc-page-header">
      <div>
        {eyebrow ? <p className="lc-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="lc-page-actions">{actions}</div> : null}
    </section>
  )
}

type ButtonLinkProps = {
  href: string
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  className?: string
}

export function ButtonLink({
  href,
  children,
  variant = 'secondary',
  className,
}: ButtonLinkProps) {
  return (
    <Link href={href} className={cx('lc-button', `lc-button-${variant}`, className)}>
      {children}
    </Link>
  )
}

type StatCardProps = {
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}

export function StatCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: StatCardProps) {
  return (
    <article className={cx('lc-stat-card', `lc-stat-${tone}`)}>
      <p className="lc-stat-label">{label}</p>
      <div className="lc-stat-value">{value}</div>
      {detail ? <p className="lc-stat-detail">{detail}</p> : null}
    </article>
  )
}

type SectionCardProps = {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: SectionCardProps) {
  return (
    <section className={cx('lc-card', className)}>
      {(title || description || actions) ? (
        <div className="lc-card-header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="lc-card-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

type EmptyStateProps = {
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="lc-empty-state">
      <div className="lc-empty-icon" aria-hidden="true">
        LC
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}