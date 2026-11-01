import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index, unique, primaryKey, foreignKey } from 'drizzle-orm/sqlite-core';
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
    vectorsKey: text("vectors_key"), // storage key of the album vector file (LSV1)
    vectorsCount: integer("vectors_count"),
    vectorsModel: text("vectors_model"),
    vectorsPrevKey: text("vectors_prev_key"), // previous vector file, kept for share tabs still reading it
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
    capturedAt: integer("captured_at"), // unix ms (EXIF capture time)
    burstId: text("burst_id"),
    isBurstCover: integer("is_burst_cover", { mode: "boolean" }),
    momentId: text("moment_id"),
    phash: text("phash"), // 16-char hex perceptual hash
    sharpness: real("sharpness"),
    thumbhash: text("thumbhash"), // base64
    tags: text("tags"), // space-separated tag slugs
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
}, (t) => {
    return {
        albumIdIdx: index('images_album_id_idx').on(t.albumId),
        sourceImageHashIdx: index('images_source_image_hash_idx').on(t.sourceImageHash),
        uploadOrderIdx: index('images_upload_order_idx').on(t.albumId, t.uploadOrder),
        capturedAtIdx: index('images_captured_at_idx').on(t.albumId, t.capturedAt),
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

// Photographer-defined custom groups. The desktop app owns the structure and replaces it wholesale.
export const albumSets = sqliteTable("album_sets", {
    albumId: text("album_id", { length: 25 }).notNull().references(() => albums.id, { onDelete: "cascade" }),
    id: text("id").notNull(), // client-generated, unique per album
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    coverImageId: integer("cover_image_id").references(() => images.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
}, (t) => {
    return {
        pk: primaryKey({ columns: [t.albumId, t.id] }),
        albumPositionIdx: index('album_sets_album_position_idx').on(t.albumId, t.position),
    }
});

export const setImages = sqliteTable("set_images", {
    albumId: text("album_id", { length: 25 }).notNull(),
    setId: text("set_id").notNull(),
    imageId: integer("image_id").notNull().references(() => images.id, { onDelete: "cascade" }),
    position: integer("position"),
}, (t) => {
    return {
        pk: primaryKey({ columns: [t.albumId, t.setId, t.imageId] }),
        setFk: foreignKey({ columns: [t.albumId, t.setId], foreignColumns: [albumSets.albumId, albumSets.id] }).onDelete("cascade"),
        imageIdIdx: index('set_images_image_id_idx').on(t.imageId),
    }
});

// Recognized faces/people. The desktop app owns them; rows are upserted so client links survive a re-sync.
export const albumPeople = sqliteTable("album_people", {
    albumId: text("album_id", { length: 25 }).notNull().references(() => albums.id, { onDelete: "cascade" }),
    id: text("id").notNull(), // client-generated, unique per album
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    coverImageId: integer("cover_image_id").references(() => images.id, { onDelete: "set null" }),
    box: text("box"), // JSON [x,y,w,h], normalized 0..1, on the cover image
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
}, (t) => {
    return {
        pk: primaryKey({ columns: [t.albumId, t.id] }),
        albumPositionIdx: index('album_people_album_position_idx').on(t.albumId, t.position),
    }
});

export const imagePeople = sqliteTable("image_people", {
    albumId: text("album_id", { length: 25 }).notNull(),
    personId: text("person_id").notNull(),
    imageId: integer("image_id").notNull().references(() => images.id, { onDelete: "cascade" }),
}, (t) => {
    return {
        pk: primaryKey({ columns: [t.albumId, t.personId, t.imageId] }),
        personFk: foreignKey({ columns: [t.albumId, t.personId], foreignColumns: [albumPeople.albumId, albumPeople.id] }).onDelete("cascade"),
        imageIdIdx: index('image_people_image_id_idx').on(t.imageId),
    }
});

// Which person a share-link client is. Owner-only; never exposed publicly.
export const clientPeople = sqliteTable("client_people", {
    albumId: text("album_id", { length: 25 }).notNull().references(() => albums.id, { onDelete: "cascade" }),
    clientName: text("client_name").notNull(),
    personId: text("person_id"),
}, (t) => {
    return {
        pk: primaryKey({ columns: [t.albumId, t.clientName] }),
        // Composite FK can't SET NULL (album_id is NOT NULL), so a dropped person drops the link.
        personFk: foreignKey({ columns: [t.albumId, t.personId], foreignColumns: [albumPeople.albumId, albumPeople.id] }).onDelete("cascade"),
    }
});
