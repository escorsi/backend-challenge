import type { UserRole } from '../../../shared/domain/enums/user-role.enum';

export interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

export interface AuthUserReader {
  findByEmail(email: string): Promise<AuthUserRecord | null>;
}
