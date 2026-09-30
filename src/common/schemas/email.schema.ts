import { z } from 'zod';

// Single source so login and signup cannot drift; 255 matches the DB column limit.
export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(255));
