import ShopClientPremium from '@/components/shop/variants/shop-client-premium'
import { getApiUrl, getShopArticles } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function PremiumShopPage() {
  const articles = await getShopArticles()

  return <ShopClientPremium articles={articles} apiUrl={getApiUrl()} />
}