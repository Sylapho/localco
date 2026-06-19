export const articleCategories = [
  'JARS',
  'CUTS',
  'PREPARATIONS',
  'SKEWERS',
  'EGGS',
  'PACKS',
  'OTHER',
] as const

export type ArticleCategory = (typeof articleCategories)[number]

export type CategoryFilter = 'ALL' | ArticleCategory

export const defaultArticleCategory: ArticleCategory = 'OTHER'

export const articleCategoryLabels: Record<ArticleCategory, string> = {
  JARS: 'Bocaux',
  CUTS: 'Découpes',
  PREPARATIONS: 'Préparations',
  SKEWERS: 'Brochettes',
  EGGS: 'Œufs',
  PACKS: 'Packs',
  OTHER: 'Autres',
}

export const categoryFilterLabels: Record<CategoryFilter, string> = {
  ALL: 'Toutes',
  ...articleCategoryLabels,
}

export function isArticleCategory(value: unknown): value is ArticleCategory {
  return articleCategories.includes(value as ArticleCategory)
}

export function getArticleCategory(value: unknown): ArticleCategory {
  return isArticleCategory(value) ? value : defaultArticleCategory
}
