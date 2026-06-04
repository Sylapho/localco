export const pickupPoints = [
  {
    label: 'Marché de Gaillon',
    schedule: 'Mardi matin, 8h-12h',
  },
  {
    label: 'Marché du Neubourg',
    schedule: 'Mercredi matin, 8h-12h',
  },
  {
    label: 'Marché de Conches',
    schedule: 'Jeudi matin, 8h-12h',
  },
  {
    label: 'À la ferme',
    schedule: 'Vendredi après-midi, 16h-18h',
  },
  {
    label: 'À la ferme',
    schedule: 'Samedi matin, 8h-12h',
  },
  {
    label: "AMAP d'Houlbec-Cocherel",
    schedule: 'Jeudi, tous les 15 jours',
  },
  {
    label: 'AMAP Autheuil-Authouillet',
    schedule: 'Jeudi, tous les 15 jours',
  },
]

export function formatPickupPoint(point: (typeof pickupPoints)[number]) {
  return `${point.label} - ${point.schedule}`
}
