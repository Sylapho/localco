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

export async function getShopArticles(): Promise<ShopArticle[]> {
  const response = await fetch(`${API_URL}/boutique/articles`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Impossible de charger les articles')
  }

  return response.json()
}

export function getApiUrl() {
  return API_URL
}
