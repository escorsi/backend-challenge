import { UserRole } from '@/shared/domain/enums/user-role.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
