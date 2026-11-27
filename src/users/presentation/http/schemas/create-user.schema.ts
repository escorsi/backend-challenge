import { z } from 'zod';

export const createUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    password: z.string().min(8).max(128),
  })
  .strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;
