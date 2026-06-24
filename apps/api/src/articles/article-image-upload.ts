import { BadRequestException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { mkdirSync } from 'fs'
import { join } from 'path'

export const ARTICLE_IMAGE_MAX_SIZE_BYTES = 2 * 1024 * 1024
export const ARTICLE_IMAGE_UPLOAD_ROOT = join(process.cwd(), 'uploads')
export const ARTICLE_IMAGE_UPLOAD_DIR = join(
  ARTICLE_IMAGE_UPLOAD_ROOT,
  'articles',
)

const allowedMimeTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])

export function ensureArticleImageUploadDir() {
  mkdirSync(ARTICLE_IMAGE_UPLOAD_DIR, { recursive: true })
}

export function articleImageFileFilter(
  _req: unknown,
  file: { mimetype: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!allowedMimeTypes.has(file.mimetype)) {
    callback(
      new BadRequestException(
        'Format invalide. Utilisez une image JPEG, PNG ou WebP.',
      ),
      false,
    )
    return
  }

  callback(null, true)
}

export function buildArticleImageFilename(articleId: string, mimetype: string) {
  const extension = allowedMimeTypes.get(mimetype)

  if (!extension) {
    throw new BadRequestException(
      'Format invalide. Utilisez une image JPEG, PNG ou WebP.',
    )
  }

  return `article-${articleId}-${Date.now()}-${randomUUID()}.${extension}`
}

export function buildArticleImagePath(filename: string) {
  return `/uploads/articles/${filename}`
}
