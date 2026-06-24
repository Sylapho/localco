import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getImageUrl } from './image-url'

describe('getImageUrl', () => {
  it('builds API URLs for uploaded image paths', () => {
    assert.equal(
      getImageUrl('/uploads/articles/article-1.jpg'),
      'http://localhost:4000/uploads/articles/article-1.jpg',
    )
  })

  it('rewrites uploaded image URLs that point to the frontend host', () => {
    assert.equal(
      getImageUrl('http://localhost:3000/uploads/articles/article-1.jpg'),
      'http://localhost:4000/uploads/articles/article-1.jpg',
    )
  })

  it('keeps missing images empty', () => {
    assert.equal(getImageUrl(null), null)
    assert.equal(getImageUrl(''), null)
  })
})
