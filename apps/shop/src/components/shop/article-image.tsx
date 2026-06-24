import type { ShopArticle } from '@/lib/api'
import { getImageUrl } from '@/lib/image-url'
import Image from 'next/image'

type ArticleImageProps = {
  article: Pick<ShopArticle, 'nom' | 'imageUrl'>
  large?: boolean
}

export default function ArticleImage({ article, large = false }: ArticleImageProps) {
  const heightClass = large ? 'h-80' : 'h-44'
  const imageUrl = getImageUrl(article.imageUrl)

  if (imageUrl) {
    return (
      <div
        className={`relative ${heightClass} overflow-hidden rounded-t-[1.35rem] bg-zinc-100`}
      >
        <Image
          src={imageUrl}
          alt={article.nom}
          fill
          sizes={large ? '720px' : '(max-width: 720px) 50vw, 320px'}
          className="object-cover transition duration-300 group-hover:scale-105"
        />
      </div>
    )
  }

  return (
    <div
      className={`flex ${heightClass} items-center justify-center rounded-t-[1.35rem] bg-[#fceef6] text-4xl font-black uppercase text-[#b5006e]`}
    >
      {article.nom.slice(0, 2)}
    </div>
  )
}
