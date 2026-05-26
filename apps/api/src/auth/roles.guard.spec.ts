import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from './roles.decorator'
import { ROLES } from './roles'
import { RolesGuard } from './roles.guard'

type TestRequest = {
  userRole?: string
}

describe('RolesGuard', () => {
  const reflector = new Reflector()
  const guard = new RolesGuard(reflector)

  function createContext(request: TestRequest, handler: () => void) {
    class TestController {}

    return {
      getHandler: () => handler,
      getClass: () => TestController,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext
  }

  it('should allow routes without roles metadata', () => {
    const handler = () => undefined
    const context = createContext({}, handler)

    expect(guard.canActivate(context)).toBe(true)
  })

  it('should allow a user with an authorized role', () => {
    const handler = () => undefined
    Reflect.defineMetadata(ROLES_KEY, [ROLES.GERANT, ROLES.COMPTABLE], handler)

    const context = createContext({ userRole: ROLES.COMPTABLE }, handler)

    expect(guard.canActivate(context)).toBe(true)
  })

  it('should reject a user with a forbidden role', () => {
    const handler = () => undefined
    Reflect.defineMetadata(ROLES_KEY, [ROLES.GERANT], handler)

    const context = createContext({ userRole: ROLES.VENDEUR }, handler)

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
  })

  it('should reject requests without userRole when roles are required', () => {
    const handler = () => undefined
    Reflect.defineMetadata(ROLES_KEY, [ROLES.GERANT], handler)

    const context = createContext({}, handler)

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
  })
})
