import { PickupPointsController } from './pickup-points.controller'
import { PickupPointsService } from './pickup-points.service'

describe('PickupPointsController', () => {
  const pickupPointsServiceMock = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
    reactivate: jest.fn(),
  }

  let controller: PickupPointsController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new PickupPointsController(
      pickupPointsServiceMock as unknown as PickupPointsService,
    )
  })

  it('findAll should return pickup points', async () => {
    const result = [
      {
        id: 1,
        label: 'Market',
        schedule: 'Tuesday morning',
        active: true,
      },
    ]
    pickupPointsServiceMock.findAll.mockResolvedValue(result)

    await expect(controller.findAll()).resolves.toEqual(result)
  })

  it('create should return created pickup point', async () => {
    const body = {
      label: 'Market',
      address: '12 Example Street',
      schedule: 'Tuesday morning',
      allowedWeekdays: [2],
    }
    const result = { id: 1, ...body, active: true }
    pickupPointsServiceMock.create.mockResolvedValue(result)

    await expect(controller.create(body)).resolves.toEqual(result)
    expect(pickupPointsServiceMock.create).toHaveBeenCalledWith(body)
  })

  it('update should return updated pickup point', async () => {
    const body = {
      schedule: 'Friday afternoon',
    }
    const result = { id: 1, schedule: 'Friday afternoon' }
    pickupPointsServiceMock.update.mockResolvedValue(result)

    await expect(controller.update(1, body)).resolves.toEqual(result)
    expect(pickupPointsServiceMock.update).toHaveBeenCalledWith(1, body)
  })

  it('deactivate should return deactivated pickup point', async () => {
    const result = { id: 1, active: false }
    pickupPointsServiceMock.deactivate.mockResolvedValue(result)

    await expect(controller.deactivate(1)).resolves.toEqual(result)
    expect(pickupPointsServiceMock.deactivate).toHaveBeenCalledWith(1)
  })

  it('reactivate should return reactivated pickup point', async () => {
    const result = { id: 1, active: true }
    pickupPointsServiceMock.reactivate.mockResolvedValue(result)

    await expect(controller.reactivate(1)).resolves.toEqual(result)
    expect(pickupPointsServiceMock.reactivate).toHaveBeenCalledWith(1)
  })
})
