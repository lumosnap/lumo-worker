import { pgTable, serial, integer, varchar, timestamp, index, decimal, bigint, boolean, jsonb, text, pgEnum } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(), // e.g. "Trial", "Base"
  displayName: varchar("display_name", { length: 100 }).notNull(),
  priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }).default("0.00"),
  imageLimit: integer("image_limit").default(500).notNull(), // New field
  // Restoring legacy/future fields to prevent build break
  storageLimit: bigint("storage_limit", { mode: "number" }),
  maxAlbums: integer("max_albums"),
  features: jsonb("features"),
  description: text("description"),
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
  status: varchar("status", { length: 50 }).notNull().default('active'), // active, expired, cancelled
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).defaultNow().notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }), // Restored
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => {
  return {
    userIdIdx: index('subscriptions_user_id_idx').on(t.userId),
    stripeSubscriptionIdIdx: index('subscriptions_stripe_subscription_id_idx').on(t.stripeSubscriptionId),
  }
});

export const requestStatusEnum = pgEnum('request_status', ['pending', 'approved', 'rejected']);

export const planRequests = pgTable('plan_requests', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }).notNull(),
  planId: integer('plan_id').references(() => plans.id).notNull(),
  status: requestStatusEnum('status').default('pending').notNull(),
  adminNotes: text('admin_notes'),
  durationMonths: integer('duration_months').default(12),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  reviewedBy: text('reviewed_by').references(() => user.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
});