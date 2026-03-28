import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
    role: text("role"),
    banned: integer("banned", { mode: "boolean" }).default(false),
    banReason: text("ban_reason"),
    banExpires: integer("ban_expires", { mode: "timestamp" }),
});

export const session = sqliteTable(
    "session",
    {
        id: text("id").primaryKey(),
        expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
        token: text("token").notNull().unique(),
        createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        impersonatedBy: text("impersonated_by"),
    },
    (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
    "account",
    {
        id: text("id").primaryKey(),
        accountId: text("account_id").notNull(),
        providerId: text("provider_id").notNull(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        accessToken: text("access_token"),
        refreshToken: text("refresh_token"),
        idToken: text("id_token"),
        accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
        refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
        scope: text("scope"),
        password: text("password"),
        createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
    },
    (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
    "verification",
    {
        id: text("id").primaryKey(),
        identifier: text("identifier").notNull(),
        value: text("value").notNull(),
        expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
        createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
    },
    (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const deviceCode = sqliteTable(
    "deviceCode",
    {
        id: text("id").primaryKey(),
        deviceCode: text("device_code").notNull().unique(),
        userCode: text("user_code").notNull().unique(),
        userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
        status: text("status").notNull().default("pending"),
        expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
        lastPolledAt: integer("last_polled_at", { mode: "timestamp" }),
        clientId: text("client_id"),
        scope: text("scope"),
        createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
    },
    (table) => [
        index("deviceCode_userCode_idx").on(table.userCode),
        index("deviceCode_deviceCode_idx").on(table.deviceCode),
        index("deviceCode_userId_idx").on(table.userId),
        index("deviceCode_status_idx").on(table.status),
        index("deviceCode_expiresAt_idx").on(table.expiresAt),
    ],
);

export const userRelations = relations(user, ({ many }) => ({
    sessions: many(session),
    accounts: many(account),
    deviceCodes: many(deviceCode),
}));

export const sessionRelations = relations(session, ({ one }) => ({
    user: one(user, {
        fields: [session.userId],
        references: [user.id],
    }),
}));

export const accountRelations = relations(account, ({ one }) => ({
    user: one(user, {
        fields: [account.userId],
        references: [user.id],
    }),
}));

export const deviceCodeRelations = relations(deviceCode, ({ one }) => ({
    user: one(user, {
        fields: [deviceCode.userId],
        references: [user.id],
    }),
}));
