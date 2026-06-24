'use client'

import ArticleImage from '@/components/articles/article-image'
import type { Article } from '@/lib/api'
import { getApiErrorMessage, getUnknownErrorMessage } from '@/lib/api-error'
import {
  articleCategories,
  articleCategoryLabels,
  defaultArticleCategory,
  isArticleCategory,
  type ArticleCategory,
} from '@/lib/article-categories'
import { centsToEuros, eurosToCents } from '@/lib/money'
import { useSessionFetch } from '@/lib/use-session-fetch'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'

type EditArticleFormProps = {
  article: Article
}

const API_URL = process.env.NEXT_PUBLIC_API_URL
const ARTICLE_IMAGE_MAX_SIZE_BYTES = 2 * 2048 * 2048
const ARTICLE_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'

export default function EditArticleForm({ article }: EditArticleFormProps) {
  const router = useRouter()
  const sessionFetch = useSessionFetch()

  const [nom, setNom] = useState(article.nom)
  const [category, setCategory] = useState<ArticleCategory>(
    isArticleCategory(article.category)
      ? article.category
      : defaultArticleCategory,
  )
  const [prix, setPrix] = useState(String(centsToEuros(article.prixCents)))
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [description, setDescription] = useState(article.description ?? '')
  const [online, setOnline] = useState(article.online)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const imagePreviewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (imagePreviewUrlRef.current) {
        URL.revokeObjectURL(imagePreviewUrlRef.current)
      }
    }
  }, [])

  function setSelectedImage(file: File | null) {
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current)
      imagePreviewUrlRef.current = null
    }

    setImageFile(file)

    if (!file) {
      setImagePreviewUrl('')
      return
    }

    const previewUrl = URL.createObjectURL(file)
    imagePreviewUrlRef.current = previewUrl
    setImagePreviewUrl(previewUrl)
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null

    if (!file) {
      setSelectedImage(null)
      return
    }

    if (!ARTICLE_IMAGE_ACCEPT.split(',').includes(file.type)) {
      setError('Format invalide. Utilisez une image JPEG, PNG ou WebP.')
      event.target.value = ''
      setSelectedImage(null)
      return
    }

    if (file.size > ARTICLE_IMAGE_MAX_SIZE_BYTES) {
      setError('Image trop lourde. Taille maximale : 2 Mo.')
      event.target.value = ''
      setSelectedImage(null)
      return
    }

    setError('')
    setSelectedImage(file)
  }

  async function uploadArticleImage(file: File) {
    const formData = new FormData()
    formData.append('image', file)

    const response = await sessionFetch(
      `${API_URL}/articles/${article.id}/image`,
      {
        method: 'POST',
        body: formData,
      },
    )

    if (!response.ok) {
      throw new Error(
        await getApiErrorMessage(response, 'Erreur lors de l’upload image.'),
      )
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await sessionFetch(`${API_URL}/articles/${article.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nom,
          category,
          prixCents: eurosToCents(Number(prix)),
          description: description || undefined,
          online,
        }),
      })

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response, 'Erreur lors de la mise à jour.'),
        )
      }

      if (imageFile) {
        await uploadArticleImage(imageFile)
      }

      router.push(`/articles/${article.id}`)
      router.refresh()
    } catch (err) {
      setError(getUnknownErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-xl gap-4">
      <div className="grid gap-1">
        <label htmlFor="nom">Nom</label>
        <input
          id="nom"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="rounded border px-3 py-2"
          required
        />
      </div>

      <div className="grid gap-1">
        <label htmlFor="prix">Prix</label>
        <input
          id="prix"
          type="number"
          step="0.01"
          min="0"
          value={prix}
          onChange={(e) => setPrix(e.target.value)}
          className="rounded border px-3 py-2"
          required
        />
      </div>

      <div className="grid gap-1">
        <label htmlFor="category">Catégorie</label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ArticleCategory)}
          className="rounded border px-3 py-2"
        >
          {articleCategories.map((item) => (
            <option key={item} value={item}>
              {articleCategoryLabels[item]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1">
        <span>Stock</span>
        <p className="rounded border bg-gray-50 px-3 py-2 text-gray-700">
          {article.stock}
        </p>
      </div>

      <div className="grid gap-1">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded border px-3 py-2"
          rows={4}
        />
      </div>

      <div className="grid gap-1">
        <label htmlFor="image">Image</label>
        <input
          id="image"
          type="file"
          accept={ARTICLE_IMAGE_ACCEPT}
          onChange={handleImageChange}
          className="rounded border px-3 py-2"
        />
        <p className="text-sm text-gray-600">
          Sélectionnez un nouveau fichier pour remplacer l’image actuelle.
          Formats acceptés : JPEG, PNG ou WebP, 2 Mo maximum.
        </p>
        {imagePreviewUrl ? (
          <Image
            src={imagePreviewUrl}
            alt="Aperçu de la nouvelle image"
            width={128}
            height={128}
            unoptimized
            className="mt-2 h-32 w-32 rounded border object-cover"
          />
        ) : article.imageUrl ? (
          <ArticleImage
            article={article}
            className="mt-2 h-32 w-32 overflow-hidden rounded border bg-gray-100"
          />
        ) : (
          <p className="mt-2 rounded border bg-gray-50 px-3 py-2 text-sm text-gray-600">
            Aucune image définie.
          </p>
        )}
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={online}
          onChange={(e) => setOnline(e.target.checked)}
        />
        En ligne
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </button>

        <button
          type="button"
          onClick={() => router.push(`/articles/${article.id}`)}
          className="rounded border px-4 py-2"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
