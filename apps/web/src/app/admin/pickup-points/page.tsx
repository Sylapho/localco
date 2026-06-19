import {
  createPickupPoint,
  deactivatePickupPoint,
  getPickupPoints,
  reactivatePickupPoint,
  updatePickupPoint,
  type PickupPoint,
} from '@/lib/api'
import { getCurrentAuthSession } from '@/lib/admin-users'
import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import type React from 'react'

const weekdays = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 0, label: 'Dimanche' },
] as const

async function createPickupPointAction(formData: FormData) {
  'use server'

  await createPickupPoint({
    ...parsePickupPointForm(formData),
    active: formData.get('active') === 'on',
  })

  revalidatePath('/admin/pickup-points')
}

async function updatePickupPointAction(formData: FormData) {
  'use server'

  const id = Number(formData.get('id'))

  await updatePickupPoint(id, parsePickupPointForm(formData))

  revalidatePath('/admin/pickup-points')
}

async function deactivatePickupPointAction(formData: FormData) {
  'use server'

  const id = Number(formData.get('id'))

  await deactivatePickupPoint(id)

  revalidatePath('/admin/pickup-points')
}

async function reactivatePickupPointAction(formData: FormData) {
  'use server'

  const id = Number(formData.get('id'))

  await reactivatePickupPoint(id)

  revalidatePath('/admin/pickup-points')
}

function parsePickupPointForm(formData: FormData) {
  const allowedWeekdays = formData
    .getAll('allowedWeekdays')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value))

  const alternatingWeekAnchorDate = getFormString(
    formData,
    'alternatingWeekAnchorDate',
  )

  return {
    label: getFormString(formData, 'label'),
    address: getFormString(formData, 'address'),
    schedule: getFormString(formData, 'schedule'),
    allowedWeekdays,
    alternatingWeekAnchorDate: alternatingWeekAnchorDate || null,
  }
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key)

  return typeof value === 'string' ? value.trim() : ''
}

function formatWeekdays(values: number[]) {
  return weekdays
    .filter((weekday) => values.includes(weekday.value))
    .map((weekday) => weekday.label.toLowerCase())
    .join(', ')
}

export default async function AdminPickupPointsPage() {
  const session = await getCurrentAuthSession()

  if (!session) {
    redirect('/sign-in')
  }

  if (session.user.role !== 'gerant') {
    notFound()
  }

  const pickupPoints = await getPickupPoints()

  return (
    <main className="p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Administration
          </p>
          <h1 className="mt-2 text-3xl font-bold">Points de retrait</h1>
          <p className="mt-2 max-w-2xl text-zinc-600">
            Gere les lieux visibles dans la boutique et les jours proposés au
            checkout.
          </p>
        </div>
      </div>

      <section className="mb-6 rounded border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Nouveau point de retrait</h2>
        <PickupPointForm
          action={createPickupPointAction}
          submitLabel="Créer le point"
          defaultActive
        />
      </section>

      <section className="grid gap-4">
        {pickupPoints.length === 0 ? (
          <div className="rounded border bg-white p-6 text-sm text-zinc-600 shadow-sm">
            Aucun point de retrait pour le moment.
          </div>
        ) : (
          pickupPoints.map((pickupPoint) => (
            <PickupPointRow key={pickupPoint.id} pickupPoint={pickupPoint} />
          ))
        )}
      </section>
    </main>
  )
}

function PickupPointRow({ pickupPoint }: { pickupPoint: PickupPoint }) {
  return (
    <article className="rounded border bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{pickupPoint.label}</h2>
            <span
              className={
                pickupPoint.active
                  ? 'rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800'
                  : 'rounded bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600'
              }
            >
              {pickupPoint.active ? 'Actif' : 'Inactif'}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-600">{pickupPoint.address}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {formatWeekdays(pickupPoint.allowedWeekdays)} ·{' '}
            {pickupPoint.schedule}
          </p>
        </div>

        <form
          action={
            pickupPoint.active
              ? deactivatePickupPointAction
              : reactivatePickupPointAction
          }
        >
          <input type="hidden" name="id" value={pickupPoint.id} />
          <button
            type="submit"
            className={
              pickupPoint.active
                ? 'rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700'
                : 'rounded border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700'
            }
          >
            {pickupPoint.active ? 'Désactiver' : 'Réactiver'}
          </button>
        </form>
      </div>

      <PickupPointForm
        action={updatePickupPointAction}
        pickupPoint={pickupPoint}
        submitLabel="Enregistrer"
      />
    </article>
  )
}

function PickupPointForm({
  action,
  pickupPoint,
  submitLabel,
  defaultActive = false,
}: {
  action: (formData: FormData) => Promise<void>
  pickupPoint?: PickupPoint
  submitLabel: string
  defaultActive?: boolean
}) {
  return (
    <form action={action} className="mt-4 grid gap-4">
      {pickupPoint ? (
        <input type="hidden" name="id" value={pickupPoint.id} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Nom affiché">
          <input
            name="label"
            required
            maxLength={120}
            defaultValue={pickupPoint?.label}
            className={inputClassName}
          />
        </Field>

        <Field label="Adresse ou description">
          <input
            name="address"
            required
            maxLength={240}
            defaultValue={pickupPoint?.address}
            className={inputClassName}
          />
        </Field>

        <Field label="Horaire affiché">
          <input
            name="schedule"
            required
            maxLength={120}
            defaultValue={pickupPoint?.schedule}
            className={inputClassName}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <fieldset>
          <legend className="text-sm font-semibold text-zinc-900">
            Jours autorisés
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {weekdays.map((weekday) => (
              <label
                key={weekday.value}
                className="flex items-center gap-2 rounded border bg-zinc-50 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="allowedWeekdays"
                  value={weekday.value}
                  defaultChecked={
                    pickupPoint
                      ? pickupPoint.allowedWeekdays.includes(weekday.value)
                      : weekday.value === 2
                  }
                />
                {weekday.label}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="Ancre 15 jours">
          <input
            type="date"
            name="alternatingWeekAnchorDate"
            defaultValue={pickupPoint?.alternatingWeekAnchorDate ?? ''}
            className={inputClassName}
          />
        </Field>
      </div>

      {!pickupPoint ? (
        <label className="flex w-fit items-center gap-2 rounded border bg-zinc-50 px-3 py-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={defaultActive}
          />
          Actif
        </label>
      ) : null}

      <button
        type="submit"
        className="w-fit rounded bg-black px-4 py-2 text-sm font-semibold text-white"
      >
        {submitLabel}
      </button>
    </form>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-zinc-900">
      {label}
      {children}
    </label>
  )
}

const inputClassName =
  'min-h-10 rounded border border-zinc-200 bg-white px-3 text-sm font-normal text-zinc-900 outline-none focus:border-black'
