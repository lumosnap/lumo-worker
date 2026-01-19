import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, real } from 'drizzle-orm/sqlite-core';
import { user } from './auth';

export const plans = sqliteTable("plans", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name", { length: 50 }).notNull().unique(), // e.g. "Trial", "Base"
    displayName: text("display_name", { length: 100 }).notNull(),
    priceMonthly: real("price_monthly").default(0.00), // decimal -> real
    imageLimit: integer("image_limit").default(500).notNull(),
    storageLimit: integer("storage_limit"), // bigint -> integer
    maxAlbums: integer("max_albums"),
    features: text("features"), // jsonb -> text (store as JSON string)
    description: text("description"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
}, (t) => {
    return {
        nameIdx: index('plans_name_idx').on(t.name),
    }
});

export const subscriptions = sqliteTable("subscriptions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }).unique(),
    planId: integer("plan_id").references(() => plans.id, { onDelete: "cascade" }),
    status: text("status", { length: 50 }).notNull().default('active'), // active, expired, cancelled
    currentPeriodStart: integer("current_period_start", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
    currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }).notNull(),
    stripeSubscriptionId: text("stripe_subscription_id", { length: 255 }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
}, (t) => {
    return {
        userIdIdx: index('subscriptions_user_id_idx').on(t.userId),
        stripeSubscriptionIdIdx: index('subscriptions_stripe_subscription_id_idx').on(t.stripeSubscriptionId),
    }
});

// pgEnum request_status -> text: 'pending' | 'approved' | 'rejected'

export const planRequests = sqliteTable('plan_requests', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }).notNull(),
    planId: integer('plan_id').references(() => plans.id).notNull(),
    status: text('status', { length: 20 }).default('pending').notNull(), // pgEnum -> text
    adminNotes: text('admin_notes'),
    durationMonths: integer('duration_months').default(12),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    reviewedBy: text('reviewed_by').references(() => user.id),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
});
