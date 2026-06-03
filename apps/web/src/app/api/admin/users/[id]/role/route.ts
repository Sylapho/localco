import { isRole } from '@/lib/roles'
import { requireGerantSession, updateUserRole } from '@/lib/admin-users'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireGerantSession()

  if (!session) {
    return NextResponse.json({ message: 'Accès interdit' }, { status: 403 })
  }

  const { id } = await context.params

  if (id === session.user.id) {
    return NextResponse.json(
      { message: 'Tu ne peux pas modifier ton propre role ici' },
      { status: 400 },
    )
  }

  const body = (await request.json()) as { role?: unknown }

  if (!isRole(body.role)) {
    return NextResponse.json({ message: 'Role invalide' }, { status: 400 })
  }

  await updateUserRole(id, body.role)

  return NextResponse.json({ success: true })
}
