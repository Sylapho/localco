const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

export type ShopArticle = {
  id: number
  nom: string
  prix: number
  tva: number
  stock: number
  online: boolean
  imageUrl?: string | null
  description?: string | null
  ingredients?: string | null
  allergenes?: string | null
}

export type CreateCommandePayload = {
  nom: string
  email: string
  tel?: string
  lieu: string
  dateRetrait?: string
  lignes: {
    articleId: number
    quantite: number
  }[]
}

export type CheckoutSummary = {
  id: number
  reference: string
  totalTTC: number
  lieu: string
  dateRetrait: string | null
  statut: string
  paiementStatut: 'confirme' | 'en_attente' | 'a_verifier' | 'annule'
  createdAt: string
  lignes: {
    nom: string
    quantite: number
    prixUnit: number
    total: number
  }[]
}

export async function getShopArticles(): Promise<ShopArticle[]> {
  const response = await fetch(`${API_URL}/boutique/articles`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Impossible de charger les articles')
  }

  return response.json()
}

export async function getCheckoutSummary(
  sessionId: string,
): Promise<CheckoutSummary | null> {
  const response = await fetch(
    `${API_URL}/commandes/checkout-session/${encodeURIComponent(sessionId)}`,
    {
      cache: 'no-store',
    },
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error('Impossible de charger la commande')
  }

  return response.json()
}

export function getApiUrl() {
  return API_URL
}
