import CreateEmployeeForm from '@/components/admin/create-employee-form'
import UserRoleSelect from '@/components/admin/user-role-select'
import {
  EmptyState,
  Page,
  PageHeader,
  SectionCard,
  StatCard,
} from '@/components/ui/dashboard'
import { listAdminUsers } from '@/lib/admin-users'
import { requireUiPermission } from '@/lib/auth-session'
import { canAccessAdmin } from '@/lib/permissions'
import { roleLabels } from '@/lib/roles'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default async function AdminUsersPage() {
  const session = await requireUiPermission(canAccessAdmin)
  const users = await listAdminUsers()
  const activeRoles = new Set(users.map((user) => user.role))

  return (
    <Page>
      <PageHeader
        eyebrow="Administration"
        title="Utilisateurs"
        description="Gérez les comptes équipe et les rôles qui donnent accès aux actions sensibles du back-office."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Comptes" value={users.length} detail="Utilisateurs internes" />
        <StatCard
          label="Rôles actifs"
          value={activeRoles.size}
          detail="Profils utilisés"
          tone="info"
        />
        <StatCard
          label="Compte courant"
          value="Protégé"
          detail="Votre propre rôle n'est pas modifiable ici"
          tone="success"
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <CreateEmployeeForm />

        <SectionCard
          title="Rôles disponibles"
          description="Chaque rôle ouvre uniquement les écrans nécessaires au métier concerné."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(roleLabels).map(([role, label]) => (
              <div
                key={role}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3"
              >
                <p className="font-bold">{label}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Code rôle : {role}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <SectionCard
        className="mt-6"
        title="Comptes équipe"
        description="Modifiez les rôles avec prudence : ils contrôlent l'accès à la caisse, au stock, aux commandes et à l'administration."
      >
        {users.length === 0 ? (
          <EmptyState
            title="Aucun utilisateur pour le moment"
            description="Créez un premier compte employé pour commencer à répartir les accès au back-office."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="lc-data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Création</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--primary-soft)] text-xs font-black text-[var(--primary)]">
                          {user.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span>
                          <span className="block font-bold">{user.name}</span>
                          {user.id === session.user.id ? (
                            <span className="text-xs text-[var(--muted)]">
                              Compte connecté
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </td>
                    <td className="break-all text-[var(--muted)]">{user.email}</td>
                    <td>
                      <UserRoleSelect
                        userId={user.id}
                        role={user.role}
                        disabled={user.id === session.user.id}
                      />
                    </td>
                    <td className="text-[var(--muted)]">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </Page>
  )
}