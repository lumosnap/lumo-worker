import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { user } from './auth';

export const profiles = sqliteTable("profiles", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }).unique(),
    businessName: text("business_name", { length: 255 }),
    phone: text("phone", { length: 20 }),
    storageUsed: integer("storage_used").default(0), // bigint -> integer
    totalImages: integer("total_images").default(0).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
}, (t) => {
    return {
        userIdIdx: index('profiles_user_id_idx').on(t.userId),
    }
});

export const billingAddresses = sqliteTable("billing_addresses", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => profiles.id, { onDelete: "cascade" }),
    street: text("street", { length: 255 }).notNull(),
    city: text("city", { length: 100 }).notNull(),
    state: text("state", { length: 100 }).notNull(),
    zip: text("zip", { length: 20 }).notNull(),
    country: text("country", { length: 100 }).notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
}, (t) => {
    return {
        userIdIdx: index('billing_addresses_user_id_idx').on(t.userId),
    }
});
