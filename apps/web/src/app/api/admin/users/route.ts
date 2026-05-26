import { createEmployee, requireGerantSession } from '@/lib/admin-users'
import { isRole } from '@/lib/roles'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const session = await requireGerantSession()

  if (!session) {
    return NextResponse.json({ message: 'Acces interdit' }, { status: 403 })
  }

  const body = (await request.json()) as {
    name?: unknown
    email?: unknown
    password?: unknown
    role?: unknown
  }

  if (
    typeof body.name !== 'string' ||
    typeof body.email !== 'string' ||
    typeof body.password !== 'string' ||
    !isRole(body.role)
  ) {
    return NextResponse.json({ message: 'Donnees invalides' }, { status: 400 })
  }

  if (body.password.length < 8) {
    return NextResponse.json(
      { message: 'Le mot de passe doit contenir au moins 8 caracteres' },
      { status: 400 },
    )
  }

  try {
    const user = await createEmployee({
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      password: body.password,
      role: body.role,
    })

    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      {
        message:
          err instanceof Error ? err.message : "Impossible de creer l'employe",
      },
      { status: 400 },
    )
  }
}
