import ShopClientClassic from '@/components/shop/variants/shop-client-classic'
import { getApiUrl, getPickupPoints, getShopArticles } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function ClassicShopPage() {
  const [articles, pickupPoints] = await Promise.all([
    getShopArticles(),
    getPickupPoints(),
  ])

  return (
    <ShopClientClassic
      articles={articles}
      apiUrl={getApiUrl()}
      pickupPoints={pickupPoints}
    />
  )
}
