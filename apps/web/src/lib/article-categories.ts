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

export function isArticleCategory(value: unknown): value is ArticleCategory {
  return articleCategories.includes(value as ArticleCategory)
}

export function getArticleCategoryLabel(value: unknown) {
  return articleCategoryLabels[
    isArticleCategory(value) ? value : defaultArticleCategory
  ]
}
