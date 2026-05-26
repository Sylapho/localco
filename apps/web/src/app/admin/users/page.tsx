import CreateEmployeeForm from '@/components/admin/create-employee-form'
import UserRoleSelect from '@/components/admin/user-role-select'
import { getCurrentAuthSession, listAdminUsers } from '@/lib/admin-users'
import { roleLabels } from '@/lib/roles'
import { notFound, redirect } from 'next/navigation'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default async function AdminUsersPage() {
  const session = await getCurrentAuthSession()

  if (!session) {
    redirect('/sign-in')
  }

  if (session.user.role !== 'gerant') {
    notFound()
  }

  const users = await listAdminUsers()

  return (
    <main className="p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Administration
          </p>
          <h1 className="mt-2 text-3xl font-bold">Utilisateurs</h1>
          <p className="mt-2 max-w-2xl text-zinc-600">
            Gere les roles qui donnent acces aux actions sensibles de LocalCo.
          </p>
        </div>
      </div>

      <section className="mb-6">
        <CreateEmployeeForm />
      </section>

      <section className="overflow-hidden rounded border bg-white shadow-sm">
        <div className="grid grid-cols-[1.2fr_1.5fr_180px_180px] gap-4 border-b bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-600">
          <span>Nom</span>
          <span>Email</span>
          <span>Role</span>
          <span>Creation</span>
        </div>

        {users.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-600">
            Aucun utilisateur pour le moment.
          </p>
        ) : (
          <div className="divide-y">
            {users.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-[1.2fr_1.5fr_180px_180px] items-center gap-4 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{user.name}</p>
                  {user.id === session.user.id ? (
                    <p className="text-xs text-zinc-500">Connecte</p>
                  ) : null}
                </div>
                <span className="break-all text-zinc-600">{user.email}</span>
                <UserRoleSelect
                  userId={user.id}
                  role={user.role}
                  disabled={user.id === session.user.id}
                />
                <span className="text-zinc-600">{formatDate(user.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <aside className="mt-6 rounded border bg-white p-4 text-sm text-zinc-600">
        <p className="font-medium text-zinc-900">Roles disponibles</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(roleLabels).map(([role, label]) => (
            <span key={role} className="rounded bg-zinc-100 px-2 py-1">
              {label}
            </span>
          ))}
        </div>
      </aside>
    </main>
  )
}
