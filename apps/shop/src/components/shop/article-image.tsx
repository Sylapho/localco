import type { ShopArticle } from '@/lib/api'
import Image from 'next/image'

type ArticleImageProps = {
  article: Pick<ShopArticle, 'nom' | 'imageUrl'>
}

export default function ArticleImage({ article }: ArticleImageProps) {
  if (article.imageUrl) {
    return (
      <div className="relative h-56 overflow-hidden bg-stone-100">
        <Image
          src={article.imageUrl}
          alt={article.nom}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
    )
  }

  return (
    <div className="flex h-56 items-center justify-center bg-gradient-to-br from-rose-50 to-stone-50 text-5xl font-semibold uppercase text-rose-800">
      <span className="font-display">{article.nom.slice(0, 2)}</span>
    </div>
  )
}