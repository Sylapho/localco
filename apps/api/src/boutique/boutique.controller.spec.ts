import { Test, TestingModule } from '@nestjs/testing'
import { BoutiqueController } from './boutique.controller'
import { BoutiqueService } from './boutique.service'

describe('BoutiqueController', () => {
  let controller: BoutiqueController

  const boutiqueServiceMock = {
    findOnlineArticles: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoutiqueController],
      providers: [
        {
          provide: BoutiqueService,
          useValue: boutiqueServiceMock,
        },
      ],
    }).compile()

    controller = module.get<BoutiqueController>(BoutiqueController)
    jest.clearAllMocks()
  })

  it('findOnlineArticles should return public articles', async () => {
    const articles = [{ id: 1, nom: 'Baguette', online: true }]
    boutiqueServiceMock.findOnlineArticles.mockResolvedValue(articles)

    await expect(controller.findOnlineArticles()).resolves.toEqual(articles)
    expect(boutiqueServiceMock.findOnlineArticles).toHaveBeenCalled()
  })
})
