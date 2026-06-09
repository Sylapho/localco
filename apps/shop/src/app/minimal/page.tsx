import ShopClientMinimal from '@/components/shop/variants/shop-client-minimal'
import { getApiUrl, getPickupPoints, getShopArticles } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function MinimalShopPage() {
  const [articles, pickupPoints] = await Promise.all([
    getShopArticles(),
    getPickupPoints(),
  ])

  return (
    <ShopClientMinimal
      articles={articles}
      apiUrl={getApiUrl()}
      pickupPoints={pickupPoints}
    />
  )
}
