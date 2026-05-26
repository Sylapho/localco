export const ROLES = {
  GERANT: 'gerant',
  VENDEUR: 'vendeur',
  PRODUCTION: 'production',
  STOCK: 'stock',
  COMPTABLE: 'comptable',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const ALL_ROLES = Object.values(ROLES)
