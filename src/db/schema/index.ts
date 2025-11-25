import { sql } from 'drizzle-orm';
import { pgTable, integer, varchar, timestamp, index, serial, boolean, text, date, decimal, bigint, jsonb } from 'drizzle-orm/pg-core';

export * from './auth';
export * from './profiles';
export * from './billing';
export * from './albums';
// Test table
export const testTable = pgTable('test_table', {
  id: integer('id').primaryKey().notNull().generatedAlwaysAsIdentity({ startWith: 1 }),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 100 }).unique(),
  message: varchar('message', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow().$onUpdateFn(() => new Date()),
}, (t) => {
  return {
    nameIdx: index('name_idx').on(t.name),
    emailIdx: index('email_idx').on(t.email),
  }
});
