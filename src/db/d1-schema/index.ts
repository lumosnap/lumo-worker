// D1 (SQLite) Schema - Index file
// Re-exports all D1-compatible schema definitions

export * from './auth';
export * from './profiles';
export * from './billing';
export * from './albums';
export * from './bookings';

// Test table for development/testing purposes
import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';

export const testTable = sqliteTable('test_table', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name', { length: 100 }).notNull(),
    email: text('email', { length: 100 }).unique(),
    message: text('message', { length: 500 }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (t) => {
    return {
        nameIdx: index('test_table_name_idx').on(t.name),
        emailIdx: index('test_table_email_idx').on(t.email),
    }
});
