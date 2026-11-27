import { UserRole } from '../../../shared/domain/enums/user-role.enum';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}
