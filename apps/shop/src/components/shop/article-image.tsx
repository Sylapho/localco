import type { ShopArticle } from '@/lib/api'
import Image from 'next/image'

type ArticleImageProps = {
  article: Pick<ShopArticle, 'nom' | 'imageUrl'>
}

export default function ArticleImage({ article }: ArticleImageProps) {
  if (article.imageUrl) {
    return (
      <div className="relative h-28 overflow-hidden rounded-t-lg bg-zinc-100">
        <Image
          src={article.imageUrl}
          alt={article.nom}
          fill
          sizes="(max-width: 720px) 50vw, 220px"
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div className="flex h-28 items-center justify-center rounded-t-lg bg-[#fceef6] text-lg font-bold uppercase text-[#b5006e]">
      {article.nom.slice(0, 2)}
    </div>
  )
}
