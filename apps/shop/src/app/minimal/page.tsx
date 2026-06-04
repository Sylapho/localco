import ShopClientMinimal from '@/components/shop/variants/shop-client-minimal'
import { getApiUrl, getShopArticles } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function MinimalShopPage() {
  const articles = await getShopArticles()

  return <ShopClientMinimal articles={articles} apiUrl={getApiUrl()} />
}