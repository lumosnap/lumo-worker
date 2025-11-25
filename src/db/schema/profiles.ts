import { pgTable, serial, text, varchar, timestamp, index, bigint, integer, boolean } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }).unique(),
  businessName: varchar("business_name", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  storageUsed: bigint("storage_used", { mode: "number" }).default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => {
  return {
    userIdIdx: index('profiles_user_id_idx').on(t.userId),
  }
});

export const billingAddresses = pgTable("billing_addresses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => profiles.id, { onDelete: "cascade" }),
  street: varchar("street", { length: 255 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  zip: varchar("zip", { length: 20 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => {
  return {
    userIdIdx: index('billing_addresses_user_id_idx').on(t.userId),
  }
});