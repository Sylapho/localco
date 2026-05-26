import { SetMetadata } from '@nestjs/common'
import { Role } from './roles'

export const ROLES_KEY = 'roles'
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)

// Utilisation sur un controller :
// @UseGuards(BetterAuthGuard, RolesGuard)
// @Roles('gerant')
// @Get()
