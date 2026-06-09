import ShopClient from '@/components/shop/shop-client'
import { getPickupPoints, getShopArticles } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const [articles, pickupPoints] = await Promise.all([
    getShopArticles(),
    getPickupPoints(),
  ])

  return <ShopClient articles={articles} pickupPoints={pickupPoints} />
}
