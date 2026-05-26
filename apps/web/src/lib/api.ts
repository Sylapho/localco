import 'server-only'

import { headers as nextHeaders } from 'next/headers'

const API_URL = process.env.NEXT_PUBLIC_API_URL

if (!API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL est manquante')
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const requestHeaders = await nextHeaders()
  const cookie = requestHeaders.get('cookie')

  if (cookie) {
    headers.set('Cookie', cookie)
  }

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })
}

export type Article = {
  id: number
  nom: string
  prix: number
  tva: number
  stock: number
  online: boolean
  emoji: string
  description?: string | null
  createdAt: string
  updatedAt: string
}

export type ArticlePayload = {
  nom: string
  prix: number
  stock?: number
  online?: boolean
  emoji?: string
  description?: string
  tva?: number
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `Erreur API - status ${response.status} - body: ${text || 'vide'}`,
    )
  }

  return response.json()
}

export async function getArticles(): Promise<Article[]> {
  const response = await apiFetch('/articles', {
    cache: 'no-store',
  })

  return parseResponse<Article[]>(response)
}

export async function getArticle(id: number): Promise<Article> {
  const response = await apiFetch(`/articles/${id}`, {
    cache: 'no-store',
  })

  return parseResponse<Article>(response)
}

export async function createArticle(data: ArticlePayload): Promise<Article> {
  const response = await apiFetch('/articles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  return parseResponse<Article>(response)
}

export async function updateArticle(
  id: number,
  data: Partial<ArticlePayload>,
): Promise<Article> {
  const response = await apiFetch(`/articles/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  return parseResponse<Article>(response)
}

export async function deleteArticle(id: number): Promise<Article> {
  const response = await apiFetch(`/articles/${id}`, {
    method: 'DELETE',
  })

  return parseResponse<Article>(response)
}

export type MatierePremiere = {
  id: number
  nom: string
  stock: number
  unite: string
  coutUnitaire: number
  seuil: number
  conditionnement: string
}

export type MatierePremierePayload = {
  nom: string
  stock: number
  unite: string
  coutUnitaire: number
  seuil: number
  conditionnement: string
}

export async function getMatieresPremieres(): Promise<MatierePremiere[]> {
  const response = await apiFetch('/matieres-premieres', {
    cache: 'no-store',
  })

  return parseResponse<MatierePremiere[]>(response)
}

export async function getMatierePremiere(
  id: number,
): Promise<MatierePremiere> {
  const response = await apiFetch(`/matieres-premieres/${id}`, {
    cache: 'no-store',
  })

  return parseResponse<MatierePremiere>(response)
}

export async function createMatierePremiere(
  data: MatierePremierePayload,
): Promise<MatierePremiere> {
  const response = await apiFetch('/matieres-premieres', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  return parseResponse<MatierePremiere>(response)
}

export async function updateMatierePremiere(
  id: number,
  data: Partial<MatierePremierePayload>,
): Promise<MatierePremiere> {
  const response = await apiFetch(`/matieres-premieres/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  return parseResponse<MatierePremiere>(response)
}

export async function deleteMatierePremiere(
  id: number,
): Promise<MatierePremiere> {
  const response = await apiFetch(`/matieres-premieres/${id}`, {
    method: 'DELETE',
  })

  return parseResponse<MatierePremiere>(response)
}
export type NomenclatureLine = {
  articleId: number
  mpId: number
  quantite: number
  mp: MatierePremiere
}

export async function getArticleNomenclature(
  articleId: number,
): Promise<NomenclatureLine[]> {
  const response = await apiFetch(`/articles/${articleId}/nomenclature`, {
    cache: 'no-store',
  })

  return parseResponse<NomenclatureLine[]>(response)
}

export async function createNomenclatureLine(data: {
  articleId: number
  mpId: number
  quantite: number
}) {
  const response = await apiFetch(
    `/articles/${data.articleId}/nomenclature`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mpId: data.mpId,
        quantite: data.quantite,
      }),
    },
  )

  return parseResponse<NomenclatureLine>(response)
}

export async function updateNomenclatureLine(data: {
  articleId: number
  mpId: number
  quantite: number
}) {
  const response = await apiFetch(
    `/articles/${data.articleId}/nomenclature/${data.mpId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantite: data.quantite,
      }),
    },
  )

  return parseResponse<NomenclatureLine>(response)
}

export async function deleteNomenclatureLine(data: {
  articleId: number
  mpId: number
}) {
  const response = await apiFetch(
    `/articles/${data.articleId}/nomenclature/${data.mpId}`,
    {
      method: 'DELETE',
    },
  )

  return parseResponse<NomenclatureLine>(response)
}

export type ProductionCapacity = {
  articleId: number
  articleNom: string
  capacite: number
  limitingIngredient: {
    mpId: number
    nom: string
    stock: number
    unite: string
    quantiteNecessaire: number
    possible: number
  } | null
  ingredients: {
    mpId: number
    nom: string
    stock: number
    unite: string
    quantiteNecessaire: number
    possible: number
  }[]
}

export async function getProductionCapacity(
  articleId: number,
): Promise<ProductionCapacity> {
  const response = await apiFetch(`/articles/${articleId}/capacity`, {
    cache: 'no-store',
  })

  return parseResponse<ProductionCapacity>(response)
}

export type ProduceArticleResponse = {
  article: Article
  produced: number
  consumed: {
    mpId: number
    nom: string
    unite: string
    quantite: number
  }[]
}

export async function produceArticle(data: {
  articleId: number
  quantite: number
}): Promise<ProduceArticleResponse> {
  const response = await apiFetch(`/articles/${data.articleId}/produce`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      quantite: data.quantite,
    }),
  })

  return parseResponse<ProduceArticleResponse>(response)
}

export type VenteMode = 'cb' | 'especes' | 'cheque'

export type LigneVente = {
  id: number
  venteId: number
  articleId: number
  quantite: number
  prixUnit: number
  tva: number
  article: Article
}

export type VenteUser = {
  id: number
  nom: string
  email: string
  role: string
  createdAt: string
}

export type Vente = {
  id: number
  date: string
  totalTTC: number
  totalHT: number
  tva: number
  mode: VenteMode
  remise: number
  userId?: number | null
  user?: VenteUser | null
  lignes: LigneVente[]
}

export type VentePayload = {
  mode: VenteMode
  remise?: number
  userId?: number
  lignes: {
    articleId: number
    quantite: number
  }[]
}

export async function getVentes(): Promise<Vente[]> {
  const response = await apiFetch('/ventes', {
    cache: 'no-store',
  })

  return parseResponse<Vente[]>(response)
}

export async function createVente(data: VentePayload): Promise<Vente> {
  const response = await apiFetch('/ventes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  return parseResponse<Vente>(response)
}

export type JourneeCaisse = {
  id: number
  date: string
  totalTTC: number
  totalHT: number
  tva: number
  especes: number
  cb: number
  cheques: number
  marge: number
  nbVentes: number
  clotureeA: string
}

export type CaisseTotals = {
  totalTTC: number
  totalHT: number
  tva: number
  especes: number
  cb: number
  cheques: number
  marge: number
  nbVentes: number
}

export type CaisseSummary = {
  date: string
  dayKey: string
  status: 'open' | 'closed'
  closedDay: JourneeCaisse | null
  totals: CaisseTotals
}

export async function getCaisseToday(): Promise<CaisseSummary> {
  const response = await apiFetch('/caisse/today', {
    cache: 'no-store',
  })

  return parseResponse<CaisseSummary>(response)
}

export async function closeCaisseToday(): Promise<JourneeCaisse> {
  const response = await apiFetch('/caisse/cloturer', {
    method: 'POST',
  })

  return parseResponse<JourneeCaisse>(response)
}

export async function getJourneesCaisse(): Promise<JourneeCaisse[]> {
  const response = await apiFetch('/caisse/journees', {
    cache: 'no-store',
  })

  return parseResponse<JourneeCaisse[]>(response)
}
