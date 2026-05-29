import ShopClient from '@/components/shop/shop-client'
import { getApiUrl, getShopArticles } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const articles = await getShopArticles()

  return <ShopClient articles={articles} apiUrl={getApiUrl()} />
}
