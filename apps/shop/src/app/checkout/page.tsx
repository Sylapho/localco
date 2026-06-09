import CheckoutClient from '@/components/shop/checkout-client'
import { getApiUrl, getPickupPoints, getShopArticles } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const [articles, pickupPoints] = await Promise.all([
    getShopArticles(),
    getPickupPoints(),
  ])

  return (
    <CheckoutClient
      articles={articles}
      apiUrl={getApiUrl()}
      pickupPoints={pickupPoints}
    />
  )
}
