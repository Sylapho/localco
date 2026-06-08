import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import { Resend } from 'resend'
import { EmailsService } from './emails.service'

jest.mock('resend', () => ({
  Resend: jest.fn(),
}))

describe('EmailsService', () => {
  let service: EmailsService
  let configGet: jest.Mock
  const sendMock = jest.fn()

  const order = {
    id: 42,
    nom: 'Marie Dupont',
    email: 'marie@example.fr',
    totalTtcCents: 1200,
    lieu: 'En boutique',
    dateRetrait: new Date('2026-06-01'),
    lignes: [
      {
        quantite: 2,
        prixUnitCents: 600,
        article: {
          nom: 'Brioche',
        },
      },
    ],
  }

  beforeEach(async () => {
    configGet = jest.fn()
    sendMock.mockResolvedValue({ data: { id: 'email_123' }, error: null })
    ;(Resend as jest.Mock).mockImplementation(() => ({
      emails: {
        send: sendMock,
      },
    }))

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailsService,
        {
          provide: ConfigService,
          useValue: {
            get: configGet,
          },
        },
      ],
    }).compile()

    service = module.get<EmailsService>(EmailsService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should skip email when Resend is not configured', async () => {
    configGet.mockReturnValue(undefined)

    await service.sendOrderConfirmation(order)

    expect(Resend).not.toHaveBeenCalled()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should send an order confirmation email', async () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'RESEND_API_KEY') return 're_test'
      if (key === 'RESEND_FROM_EMAIL') {
        return 'Les Cocottes de Diane <commande@example.com>'
      }

      return undefined
    })

    await service.sendOrderConfirmation(order)

    expect(Resend).toHaveBeenCalledWith('re_test')
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Les Cocottes de Diane <commande@example.com>',
        to: 'marie@example.fr',
        subject: 'Confirmation de votre commande #42',
      }),
    )
  })
})
