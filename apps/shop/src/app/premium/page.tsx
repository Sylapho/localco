import ShopClientPremium from '@/components/shop/variants/shop-client-premium'
import { getApiUrl, getPickupPoints, getShopArticles } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function PremiumShopPage() {
  const [articles, pickupPoints] = await Promise.all([
    getShopArticles(),
    getPickupPoints(),
  ])

  return (
    <ShopClientPremium
      articles={articles}
      apiUrl={getApiUrl()}
      pickupPoints={pickupPoints}
    />
  )
}
