import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';
import { user } from './auth';

export const albums = sqliteTable("albums", {
    id: text("id", { length: 25 }).primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    title: text("title", { length: 255 }).notNull(),
    eventDate: text("event_date"), // Store as ISO date string YYYY-MM-DD
    totalImages: integer("total_images").default(0).notNull(),
    totalSize: integer("total_size").default(0), // bigint -> integer (SQLite handles large ints)
    shareLinkToken: text("share_link_token", { length: 255 }).unique(),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    isPublic: integer("is_public", { mode: "boolean" }).default(true),
    isSecondaryStorage: integer("is_secondary_storage", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
}, (t) => {
    return {
        userIdIdx: index('albums_user_id_idx').on(t.userId),
        shareLinkTokenIdx: index('albums_share_link_token_idx').on(t.shareLinkToken),
    }
});

// pgEnum -> text (store as string values)
// upload_status: 'pending' | 'uploading' | 'complete' | 'failed'

export const images = sqliteTable("images", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    albumId: text("album_id", { length: 25 }).references(() => albums.id, { onDelete: "cascade" }),
    sourceImageHash: text("source_image_hash", { length: 255 }),
    b2FileName: text("b2_file_name", { length: 500 }).notNull(),
    originalFilename: text("original_filename", { length: 255 }).notNull(),
    fileSize: integer("file_size").notNull(), // bigint -> integer
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    uploadOrder: integer("upload_order").notNull(),
    thumbnailB2FileId: text("thumbnail_b2_file_id", { length: 255 }),
    thumbnailB2FileName: text("thumbnail_b2_file_name", { length: 500 }),
    uploadStatus: text("upload_status", { length: 20 }).default('pending'), // pgEnum -> text
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
}, (t) => {
    return {
        albumIdIdx: index('images_album_id_idx').on(t.albumId),
        sourceImageHashIdx: index('images_source_image_hash_idx').on(t.sourceImageHash),
        uploadOrderIdx: index('images_upload_order_idx').on(t.albumId, t.uploadOrder),
    }
});

export const favorites = sqliteTable("favorites", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    albumId: text("album_id", { length: 25 }).references(() => albums.id, { onDelete: "cascade" }),
    imageId: integer("image_id").references(() => images.id, { onDelete: "cascade" }),
    clientName: text("client_name", { length: 255 }).notNull(),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
}, (t) => {
    return {
        favoritesUnique: unique('favorites_unique').on(t.albumId, t.imageId, t.clientName),
    }
});
