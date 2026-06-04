import ShopClientClassic from '@/components/shop/variants/shop-client-classic'
import { getApiUrl, getShopArticles } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function ClassicShopPage() {
  const articles = await getShopArticles()

  return <ShopClientClassic articles={articles} apiUrl={getApiUrl()} />
}