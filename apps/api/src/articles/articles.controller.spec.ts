import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { ArticlesController } from './articles.controller'
import { ArticlesService } from './articles.service'
import {
  ARTICLE_IMAGE_MAX_SIZE_BYTES,
  articleImageFileFilter,
  buildArticleImageFilename,
  buildArticleImagePath,
  ensureArticleImageUploadDir,
} from './article-image-upload'

describe('ArticlesController', () => {
  let controller: ArticlesController

  const articlesServiceMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateImage: jest.fn(),
    remove: jest.fn(),
    getProductionCapacity: jest.fn(),
    produce: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArticlesController],
      providers: [
        {
          provide: ArticlesService,
          useValue: articlesServiceMock,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile()

    controller = module.get<ArticlesController>(ArticlesController)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('findAll should return articles', async () => {
    const result = [{ id: 1, nom: 'Baguette' }]
    articlesServiceMock.findAll.mockResolvedValue(result)

    await expect(controller.findAll()).resolves.toEqual(result)
  })

  it('findOne should return one article', async () => {
    const result = { id: 1, nom: 'Baguette' }
    articlesServiceMock.findOne.mockResolvedValue(result)

    await expect(controller.findOne(1)).resolves.toEqual(result)
  })

  it('create should return created article', async () => {
    const body = { nom: 'Croissant', prixCents: 110 }
    const result = { id: 2, ...body }

    articlesServiceMock.create.mockResolvedValue(result)

    await expect(controller.create(body)).resolves.toEqual(result)
  })

  it('update should return updated article', async () => {
    const body = { prixCents: 130 }
    const result = { id: 1, nom: 'Baguette', prixCents: 130 }

    articlesServiceMock.update.mockResolvedValue(result)

    await expect(controller.update(1, body)).resolves.toEqual(result)
  })

  it('uploadImage should update article image', async () => {
    const result = {
      id: 1,
      nom: 'Baguette',
      imageUrl: '/uploads/articles/article-1-test.jpg',
    }
    const file = {
      filename: 'article-1-test.jpg',
    }

    articlesServiceMock.updateImage.mockResolvedValue(result)

    await expect(controller.uploadImage(1, file)).resolves.toEqual(result)
    expect(articlesServiceMock.updateImage).toHaveBeenCalledWith(
      1,
      '/uploads/articles/article-1-test.jpg',
      'article-1-test.jpg',
    )
  })

  it('uploadImage should reject missing files', async () => {
    await expect(controller.uploadImage(1)).rejects.toThrow(
      'Aucune image fournie.',
    )
    expect(articlesServiceMock.updateImage).not.toHaveBeenCalled()
  })

  it('articleImageFileFilter should accept supported images', () => {
    const callback = jest.fn()

    articleImageFileFilter({}, { mimetype: 'image/webp' }, callback)

    expect(callback).toHaveBeenCalledWith(null, true)
  })

  it('articleImageFileFilter should reject unsupported files', () => {
    const callback = jest.fn()

    articleImageFileFilter({}, { mimetype: 'application/pdf' }, callback)

    expect(callback).toHaveBeenCalledWith(expect.any(Error), false)
  })

  it('buildArticleImageFilename should generate a safe extension from MIME type', () => {
    expect(buildArticleImageFilename('12', 'image/png')).toMatch(
      /^article-12-\d+-[0-9a-f-]+\.png$/,
    )
    expect(buildArticleImageFilename('12', 'image/jpeg')).toMatch(/\.jpg$/)
    expect(buildArticleImageFilename('12', 'image/webp')).toMatch(/\.webp$/)
  })

  it('buildArticleImageFilename should reject unsupported MIME types', () => {
    expect(() => buildArticleImageFilename('12', 'application/pdf')).toThrow(
      'Format invalide',
    )
  })

  it('buildArticleImagePath should return a public upload path', () => {
    expect(buildArticleImagePath('article-12-test.png')).toBe(
      '/uploads/articles/article-12-test.png',
    )
  })

  it('ensureArticleImageUploadDir should create the upload directory', () => {
    expect(() => ensureArticleImageUploadDir()).not.toThrow()
  })

  it('should limit article image uploads to 2 Mo', () => {
    expect(ARTICLE_IMAGE_MAX_SIZE_BYTES).toBe(2 * 1024 * 1024)
  })

  it('remove should return deleted article', async () => {
    const result = { id: 1, nom: 'Baguette' }

    articlesServiceMock.remove.mockResolvedValue(result)

    await expect(controller.remove(1)).resolves.toEqual(result)
  })

  it('getProductionCapacity should return article capacity', async () => {
    const result = {
      articleId: 1,
      articleNom: 'Baguette',
      capacite: 10,
      limitingIngredient: null,
      ingredients: [],
    }

    articlesServiceMock.getProductionCapacity.mockResolvedValue(result)

    await expect(controller.getProductionCapacity(1)).resolves.toEqual(result)
    expect(articlesServiceMock.getProductionCapacity).toHaveBeenCalledWith(1)
  })

  it('produce should return production result', async () => {
    const result = {
      article: { id: 1, nom: 'Baguette' },
      produced: 2,
      consumed: [],
    }

    articlesServiceMock.produce.mockResolvedValue(result)

    await expect(controller.produce(1, { quantite: 2 })).resolves.toEqual(
      result,
    )
    expect(articlesServiceMock.produce).toHaveBeenCalledWith(1, {
      quantite: 2,
    })
  })
})
