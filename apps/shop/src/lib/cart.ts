import type { ShopArticle } from '@/lib/api'
import { formatCurrencyFromCents } from '@/lib/money'

export type Cart = Record<number, number>

export const CART_STORAGE_KEY = 'localco-shop-cart'

export function formatCurrency(value: number) {
  return formatCurrencyFromCents(value)
}

export function readStoredCart(): Cart {
  if (typeof window === 'undefined') return {}

  try {
    const stored = window.localStorage.getItem(CART_STORAGE_KEY)
    return stored ? (JSON.parse(stored) as Cart) : {}
  } catch {
    return {}
  }
}

export function writeStoredCart(cart: Cart) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
}

export function clearStoredCart() {
  if (typeof window === 'undefined') return

  window.localStorage.removeItem(CART_STORAGE_KEY)
}

export function buildCartLines(cart: Cart, articles: ShopArticle[]) {
  const articlesById = new Map(articles.map((article) => [article.id, article]))

  return Object.entries(cart)
    .map(([articleId, quantite]) => {
      const article = articlesById.get(Number(articleId))

      if (!article) return null

      return {
        article,
        quantite,
        totalCents: article.prixCents * quantite,
      }
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line))
}

export function getCartCount(cart: Cart) {
  return Object.values(cart).reduce((sum, quantity) => sum + quantity, 0)
}

export function getCartTotal(cart: Cart, articles: ShopArticle[]) {
  return buildCartLines(cart, articles).reduce((sum, line) => {
    return sum + line.totalCents
  }, 0)
}
