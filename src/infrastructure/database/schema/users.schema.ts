import { index, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['admin', 'staff', 'customer']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    fullName: varchar('full_name', { length: 120 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: userRole('role').notNull().default('customer'),
    // ms precision matches JS Date so cursor predicates never skip rows.
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, precision: 3 }),
  },
  (t) => [index('users_created_at_id_idx').on(t.createdAt, t.id)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
