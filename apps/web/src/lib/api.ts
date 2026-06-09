import 'server-only'

import { getApiErrorMessage } from '@/lib/api-error'
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
  prixCents: number
  tvaBps: number
  stock: number
  online: boolean
  imageUrl?: string | null
  description?: string | null
  ingredients?: string | null
  allergenes?: string | null
  createdAt: string
  updatedAt: string
}

export type ArticlePayload = {
  nom: string
  prixCents: number
  stock?: number
  online?: boolean
  imageUrl?: string | null
  description?: string
  ingredients?: string | null
  allergenes?: string | null
  tvaBps?: number
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response))
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
  coutUnitaireCents: number
  seuil: number
  conditionnement: string
}

export type MatierePremierePayload = {
  nom: string
  stock: number
  unite: string
  coutUnitaireCents: number
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
  prixUnitCents: number
  tvaBps: number
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
  totalTtcCents: number
  totalHtCents: number
  tvaCents: number
  mode: VenteMode
  remiseCents: number
  userId?: number | null
  user?: VenteUser | null
  lignes: LigneVente[]
}

export type VentePayload = {
  mode: VenteMode
  remiseCents?: number
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

export type CommandeStatut =
  | 'paiement_en_attente'
  | 'nouvelle'
  | 'preparee'
  | 'traitee'
  | 'annulee'
  | 'paiement_a_verifier'

export type CommandeStatutHistorique = {
  id: number
  commandeId: number
  ancienStatut?: CommandeStatut | null
  nouveauStatut: CommandeStatut
  motif?: string | null
  createdByUserId?: string | null
  createdAt: string
}

export type LigneCommande = {
  id: number
  commandeId: number
  articleId: number
  quantite: number
  productionQuantity?: number
  prixUnitCents: number
  article: Article
}

export type Commande = {
  id: number
  nom: string
  email: string
  tel?: string | null
  totalTtcCents: number
  lieu: string
  dateRetrait?: string | null
  statut: CommandeStatut
  stripeId?: string | null
  createdAt: string
  lignes: LigneCommande[]
  historique?: CommandeStatutHistorique[]
}

export async function getCommandes(): Promise<Commande[]> {
  const response = await apiFetch('/commandes', {
    cache: 'no-store',
  })

  return parseResponse<Commande[]>(response)
}

export async function getCommande(id: number): Promise<Commande> {
  const response = await apiFetch(`/commandes/${id}`, {
    cache: 'no-store',
  })

  return parseResponse<Commande>(response)
}

export type JourneeCaisse = {
  id: number
  date: string
  totalTtcCents: number
  totalHtCents: number
  tvaCents: number
  especesCents: number
  cbCents: number
  chequesCents: number
  margeCents: number
  nbVentes: number
  clotureeA: string
}

export type CaisseTotals = {
  totalTtcCents: number
  totalHtCents: number
  tvaCents: number
  especesCents: number
  cbCents: number
  chequesCents: number
  margeCents: number
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

export type MouvementStockType =
  | 'vente'
  | 'production'
  | 'reception'
  | 'ajustement'
  | 'perte'
  | 'commande'

export type MouvementStockCible = 'article' | 'matiere_premiere'

export type MouvementStock = {
  id: number
  type: MouvementStockType
  cible: MouvementStockCible
  articleId?: number | null
  mpId?: number | null
  quantite: number
  stockAvant: number
  stockApres: number
  motif?: string | null
  reference?: string | null
  createdByUserId?: string | null
  createdAt: string
  article?: Article | null
  mp?: MatierePremiere | null
}

export type StockLot = {
  id: number
  target: MouvementStockCible
  articleId?: number | null
  mpId?: number | null
  initialQuantity: number
  remainingQuantity: number
  expiresAt?: string | null
  reference?: string | null
  createdAt: string
  updatedAt: string
  article?: Article | null
  mp?: MatierePremiere | null
}

export async function getMouvementsStock(): Promise<MouvementStock[]> {
  const response = await apiFetch('/mouvements-stock', {
    cache: 'no-store',
  })

  return parseResponse<MouvementStock[]>(response)
}

export async function getStockLots(): Promise<StockLot[]> {
  const response = await apiFetch('/mouvements-stock/lots', {
    cache: 'no-store',
  })

  return parseResponse<StockLot[]>(response)
}
