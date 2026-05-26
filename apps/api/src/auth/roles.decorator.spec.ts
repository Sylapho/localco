import 'reflect-metadata'
import { ROLES_KEY, Roles } from './roles.decorator'

describe('Roles decorator', () => {
  it('should attach roles metadata to a route handler', () => {
    class TestController {
      handler() {
        return true
      }
    }

    const descriptor = Object.getOwnPropertyDescriptor(
      TestController.prototype,
      'handler',
    )

    if (!descriptor) {
      throw new Error('Descriptor introuvable')
    }

    Roles('gerant', 'vendeur')(TestController.prototype, 'handler', descriptor)

    expect(Reflect.getMetadata(ROLES_KEY, descriptor.value)).toEqual([
      'gerant',
      'vendeur',
    ])
  })
})
