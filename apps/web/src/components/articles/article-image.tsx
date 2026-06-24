import type { Article } from '@/lib/api'
import { getImageUrl } from '@/lib/image-url'
import Image from 'next/image'

type ArticleImageProps = {
  article: Pick<Article, 'nom' | 'imageUrl'>
  className?: string
}

export default function ArticleImage({ article, className }: ArticleImageProps) {
  const baseClass =
    className ?? 'h-14 w-14 overflow-hidden rounded border bg-gray-100'
  const imageUrl = getImageUrl(article.imageUrl)

  if (imageUrl) {
    return (
      <div className={`${baseClass} relative`}>
        <Image
          src={imageUrl}
          alt={article.nom}
          fill
          sizes="96px"
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={`${baseClass} flex items-center justify-center text-xs font-semibold uppercase text-gray-500`}
      aria-label={`Image manquante pour ${article.nom}`}
    >
      {article.nom.slice(0, 2)}
    </div>
  )
}
