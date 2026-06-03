import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import { CommandesController } from './commandes.controller'
import { CommandesService } from './commandes.service'
import { CreateCommandeDto } from './dto/create-commande.dto'

describe('CommandesController', () => {
  let controller: CommandesController

  const commandesServiceMock = {
    create: jest.fn(),
    createCheckout: jest.fn(),
    handleStripeWebhook: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateStatut: jest.fn(),
    cleanupAbandonedCommandes: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommandesController],
      providers: [
        {
          provide: CommandesService,
          useValue: commandesServiceMock,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile()

    controller = module.get<CommandesController>(CommandesController)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('create should create a commande', async () => {
    const body: CreateCommandeDto = {
      nom: 'Marie Dupont',
      email: 'marie@example.fr',
      lieu: 'En boutique',
      lignes: [{ articleId: 1, quantite: 2 }],
    }
    const result = { id: 1, totalTTC: 4, lignes: [] }

    commandesServiceMock.create.mockResolvedValue(result)

    await expect(controller.create(body)).resolves.toEqual(result)
    expect(commandesServiceMock.create).toHaveBeenCalledWith(body)
  })

  it('createCheckout should create a checkout session', async () => {
    const body: CreateCommandeDto = {
      nom: 'Marie Dupont',
      email: 'marie@example.fr',
      lieu: 'En boutique',
      lignes: [{ articleId: 1, quantite: 2 }],
    }
    const result = { url: 'https://checkout.stripe.com/test' }

    commandesServiceMock.createCheckout.mockResolvedValue(result)

    await expect(controller.createCheckout(body)).resolves.toEqual(result)
    expect(commandesServiceMock.createCheckout).toHaveBeenCalledWith(body)
  })

  it('findAll should return commandes', async () => {
    const result = [{ id: 1, statut: 'nouvelle' }]
    commandesServiceMock.findAll.mockResolvedValue(result)

    await expect(controller.findAll()).resolves.toEqual(result)
    expect(commandesServiceMock.findAll).toHaveBeenCalled()
  })

  it('findOne should return one commande', async () => {
    const result = { id: 1, statut: 'nouvelle' }
    commandesServiceMock.findOne.mockResolvedValue(result)

    await expect(controller.findOne(1)).resolves.toEqual(result)
    expect(commandesServiceMock.findOne).toHaveBeenCalledWith(1)
  })

  it('cleanupAbandoned should cleanup pending commandes', async () => {
    const result = { count: 2 }
    commandesServiceMock.cleanupAbandonedCommandes.mockResolvedValue(result)

    await expect(controller.cleanupAbandoned()).resolves.toEqual(result)
    expect(commandesServiceMock.cleanupAbandonedCommandes).toHaveBeenCalled()
  })

  it('updateStatut should update commande status', async () => {
    const result = { id: 1, statut: 'preparee' }
    commandesServiceMock.updateStatut.mockResolvedValue(result)

    await expect(
      controller.updateStatut(1, { statut: 'preparee' }),
    ).resolves.toEqual(result)
    expect(commandesServiceMock.updateStatut).toHaveBeenCalledWith(
      1,
      'preparee',
    )
  })
})
