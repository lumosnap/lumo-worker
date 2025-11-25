import { pgTable, serial, integer, varchar, timestamp, index, decimal, bigint, boolean, jsonb, text } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: varchar("name", { enum: ["free", "pro", "business"] }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }).default("0.00"),
  storageLimit: bigint("storage_limit", { mode: "number" }),
  maxAlbums: integer("max_albums"),
  features: jsonb("features"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => {
  return {
    nameIdx: index('plans_name_idx').on(t.name),
  }
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }).unique(),
  planId: integer("plan_id").references(() => plans.id, { onDelete: "cascade" }),
  status: varchar("status", { enum: ["active", "cancelled", "past_due"] }).notNull(),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => {
  return {
    userIdIdx: index('subscriptions_user_id_idx').on(t.userId),
    stripeSubscriptionIdIdx: index('subscriptions_stripe_subscription_id_idx').on(t.stripeSubscriptionId),
  }
});