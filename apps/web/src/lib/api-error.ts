type ApiErrorPayload = {
  statusCode?: number
  message?: unknown
  error?: unknown
  insufficientStock?: StockIssue[]
  insufficientIngredients?: IngredientIssue[]
}

type StockIssue = {
  nom?: string
  requested?: number
  sellableStock?: number
  stock?: number
  missing?: number
}

type IngredientIssue = {
  nom?: string
  unite?: string
  needed?: number
  available?: number
  missing?: number
}

export async function getApiErrorMessage(
  response: Response,
  fallback = 'Une erreur est survenue. Réessayez dans quelques instants.',
) {
  const payload = await readApiErrorPayload(response)

  return formatApiErrorMessage(payload, response.status, fallback)
}

export function getUnknownErrorMessage(
  error: unknown,
  fallback = 'Une erreur est survenue. Réessayez dans quelques instants.',
) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

async function readApiErrorPayload(
  response: Response,
): Promise<ApiErrorPayload | null> {
  const contentType = response.headers.get('content-type') ?? ''

  try {
    if (contentType.includes('application/json')) {
      return normalizePayload(await response.json())
    }

    const text = await response.text()

    if (!text.trim()) {
      return null
    }

    try {
      return normalizePayload(JSON.parse(text))
    } catch {
      return { message: text }
    }
  } catch {
    return null
  }
}

function normalizePayload(value: unknown): ApiErrorPayload | null {
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? { message: value } : null
  }

  return value as ApiErrorPayload
}

function formatApiErrorMessage(
  payload: ApiErrorPayload | null,
  status: number,
  fallback: string,
) {
  const stockIssues = extractStockIssues(payload)

  if (stockIssues.length > 0) {
    return [
      'Stock insuffisant pour une ou plusieurs lignes.',
      ...stockIssues.map(formatStockIssue),
    ].join(' ')
  }

  const ingredientIssues = extractIngredientIssues(payload)

  if (ingredientIssues.length > 0) {
    return [
      'Stock insuffisant pour produire cet article.',
      ...ingredientIssues.map(formatIngredientIssue),
    ].join(' ')
  }

  const messages = extractMessages(payload)
  const normalized = messages.join(' ').toLowerCase()

  if (isForeignKeyError(normalized)) {
    return 'Impossible de supprimer cet élément car il est utilisé ailleurs.'
  }

  if (messages.length > 0) {
    return messages.map(formatValidationMessage).join(' ')
  }

  if (status === 401) {
    return 'Votre session a expiré. Reconnectez-vous pour continuer.'
  }

  if (status === 403) {
    return 'Vous n’avez pas les droits nécessaires pour cette action.'
  }

  if (status === 404) {
    return 'L’élément demandé est introuvable.'
  }

  if (status >= 500) {
    return 'Le serveur ne répond pas correctement. Réessayez dans quelques instants.'
  }

  return fallback
}

function extractStockIssues(payload: ApiErrorPayload | null): StockIssue[] {
  if (!payload) return []

  const nestedMessage = payload.message

  if (Array.isArray(payload.insufficientStock)) {
    return payload.insufficientStock
  }

  if (
    nestedMessage &&
    typeof nestedMessage === 'object' &&
    !Array.isArray(nestedMessage) &&
    'insufficientStock' in nestedMessage &&
    Array.isArray(nestedMessage.insufficientStock)
  ) {
    return nestedMessage.insufficientStock as StockIssue[]
  }

  return []
}

function extractIngredientIssues(
  payload: ApiErrorPayload | null,
): IngredientIssue[] {
  if (!payload) return []

  const nestedMessage = payload.message

  if (Array.isArray(payload.insufficientIngredients)) {
    return payload.insufficientIngredients
  }

  if (
    nestedMessage &&
    typeof nestedMessage === 'object' &&
    !Array.isArray(nestedMessage) &&
    'insufficientIngredients' in nestedMessage &&
    Array.isArray(nestedMessage.insufficientIngredients)
  ) {
    return nestedMessage.insufficientIngredients as IngredientIssue[]
  }

  return []
}

function extractMessages(payload: ApiErrorPayload | null): string[] {
  if (!payload) return []

  return unique([
    ...extractMessageValue(payload.message),
    ...extractMessageValue(payload.error),
  ]).filter(Boolean)
}

function extractMessageValue(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }

  if (Array.isArray(value)) {
    return value.flatMap(extractMessageValue)
  }

  if (value && typeof value === 'object' && 'message' in value) {
    return extractMessageValue(value.message)
  }

  return []
}

function formatStockIssue(issue: StockIssue) {
  const name = issue.nom ?? 'Article'
  const requested = issue.requested
  const available = issue.sellableStock ?? issue.stock
  const missing = issue.missing

  if (typeof requested === 'number' && typeof available === 'number') {
    return `${name} : ${requested} demandé(s), ${Math.max(0, available)} disponible(s).`
  }

  if (typeof missing === 'number') {
    return `${name} : ${missing} manquant(s).`
  }

  return `${name} : stock insuffisant.`
}

function formatIngredientIssue(issue: IngredientIssue) {
  const name = issue.nom ?? 'Ingrédient'
  const unit = issue.unite ? ` ${issue.unite}` : ''

  if (
    typeof issue.needed === 'number' &&
    typeof issue.available === 'number'
  ) {
    return `${name} : ${issue.needed}${unit} nécessaire(s), ${issue.available}${unit} disponible(s).`
  }

  if (typeof issue.missing === 'number') {
    return `${name} : ${issue.missing}${unit} manquant(s).`
  }

  return `${name} : stock insuffisant.`
}

function formatValidationMessage(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('must be an email')) {
    return 'L’adresse email n’est pas valide.'
  }

  if (normalized.includes('must not be less than 0')) {
    return 'Les valeurs numériques doivent être positives.'
  }

  if (normalized.includes('must not be less than 1')) {
    return 'La quantité doit être supérieure à zéro.'
  }

  if (normalized.includes('stock insuffisant')) {
    return 'Stock insuffisant pour cette action.'
  }

  if (normalized.includes('already') || normalized.includes('unique')) {
    return 'Cette donnée existe déjà.'
  }

  if (looksTechnical(message)) {
    return 'La demande est invalide. Vérifiez les champs du formulaire.'
  }

  return message
}

function looksTechnical(message: string) {
  return (
    message.includes('{') ||
    message.includes('Prisma') ||
    message.includes('Error:') ||
    message.includes('statusCode') ||
    message.includes('Bad Request')
  )
}

function isForeignKeyError(message: string) {
  return (
    message.includes('foreign key') ||
    message.includes('p2003') ||
    message.includes('constraint failed')
  )
}

function unique(values: string[]) {
  return Array.from(new Set(values))
}
