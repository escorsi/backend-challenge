import type { User } from '../../domain/models/user.interface';

export const USERS_WRITER = Symbol('USERS_WRITER');

export interface UsersWriter {
  create(user: User): Promise<void>;
}
