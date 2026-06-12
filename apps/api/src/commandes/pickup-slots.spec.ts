import {
  findPickupPoint,
  formatPickupPoint,
  getPublicPickupPoints,
  isPickupDateAllowed,
  pickupPoints,
  validatePickupSlot,
  type PickupPoint,
} from './pickup-slots'

function getPickupPointByLabel(label: string) {
  const point = pickupPoints.find((item) => item.label === label)

  if (!point) {
    throw new Error(`Missing pickup point: ${label}`)
  }

  return point
}

function dateFromInput(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  return new Date(year, month - 1, day)
}

function formatInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getNextDate(point: PickupPoint, expectedAllowed: boolean) {
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  for (let index = 0; index < 60; index += 1) {
    if (
      point.allowedWeekdays.includes(cursor.getDay()) &&
      isPickupDateAllowed(point, cursor) === expectedAllowed
    ) {
      return formatInputDate(cursor)
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  throw new Error('No matching pickup date found')
}

describe('pickup slots', () => {
  it('keeps Autheuil-Authouillet AMAP on its fortnightly Thursday schedule', () => {
    const autheuilAuthouillet = getPickupPointByLabel(
      'AMAP Autheuil-Authouillet',
    )

    expect(
      isPickupDateAllowed(autheuilAuthouillet, dateFromInput('2026-06-18')),
    ).toBe(true)
    expect(
      isPickupDateAllowed(autheuilAuthouillet, dateFromInput('2026-07-02')),
    ).toBe(true)
    expect(
      isPickupDateAllowed(autheuilAuthouillet, dateFromInput('2026-06-25')),
    ).toBe(false)
  })

  it('keeps Houlbec-Cocherel AMAP on the alternate Thursday schedule', () => {
    const houlbecCocherel = getPickupPointByLabel("AMAP d'Houlbec-Cocherel")

    expect(
      isPickupDateAllowed(houlbecCocherel, dateFromInput('2026-06-25')),
    ).toBe(true)
    expect(
      isPickupDateAllowed(houlbecCocherel, dateFromInput('2026-07-09')),
    ).toBe(true)
    expect(
      isPickupDateAllowed(houlbecCocherel, dateFromInput('2026-06-18')),
    ).toBe(false)
  })

  it('validates AMAP pickup dates against their alternating week', () => {
    const autheuilAuthouillet = getPickupPointByLabel(
      'AMAP Autheuil-Authouillet',
    )
    const lieu = formatPickupPoint(autheuilAuthouillet)

    expect(() =>
      validatePickupSlot(lieu, getNextDate(autheuilAuthouillet, true)),
    ).not.toThrow()
    expect(() =>
      validatePickupSlot(lieu, getNextDate(autheuilAuthouillet, false)),
    ).toThrow('La date de retrait ne correspond pas au lieu choisi')
  })

  it('exposes AMAP alternation anchors to the checkout', () => {
    const publicPickupPoints = getPublicPickupPoints()

    expect(
      publicPickupPoints.find(
        (point) => point.label === 'AMAP Autheuil-Authouillet',
      ),
    ).toMatchObject({
      alternatingWeekAnchorDate: '2026-06-18',
      value: 'AMAP Autheuil-Authouillet - Jeudi, tous les 15 jours',
    })
    expect(
      publicPickupPoints.find(
        (point) => point.label === "AMAP d'Houlbec-Cocherel",
      ),
    ).toMatchObject({
      alternatingWeekAnchorDate: '2026-06-25',
      value: "AMAP d'Houlbec-Cocherel - Jeudi, tous les 15 jours",
    })
  })

  it('finds pickup points from their public checkout value', () => {
    const publicPickupPoint = getPublicPickupPoints()[0]

    expect(findPickupPoint(publicPickupPoint.value)).toMatchObject({
      label: publicPickupPoint.label,
    })
  })
})
