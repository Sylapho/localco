import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Role } from '../../src/auth/roles'

export const E2E_ROLE_HEADER = 'x-e2e-user-role'

@Injectable()
export class E2eBetterAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>
      get?: (name: string) => string | undefined
      userId?: string
      userRole?: string
    }>()
    const roleHeader =
      request.headers[E2E_ROLE_HEADER] ?? request.get?.(E2E_ROLE_HEADER)
    const role = Array.isArray(roleHeader) ? roleHeader[0] : roleHeader

    if (!role) {
      throw new UnauthorizedException('E2E session role missing')
    }

    request.userId = `e2e-user-${role}`
    request.userRole = role

    return true
  }
}

export function authAs(role: Role) {
  return { [E2E_ROLE_HEADER]: role }
}
