import { pgTable, varchar, integer, timestamp, index, date, bigint, boolean, serial, text, pgEnum, unique } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const albums = pgTable("albums", {
  id: varchar("id", { length: 21 }).primaryKey(),
  userId: integer("user_id").references(() => profiles.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  eventDate: date("event_date"),
  totalImages: integer("total_images").default(0).notNull(),
  totalSize: bigint("total_size", { mode: "number" }).default(0),
  shareLinkToken: varchar("share_link_token", { length: 255 }).unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => {
  return {
    userIdIdx: index('albums_user_id_idx').on(t.userId),
    shareLinkTokenIdx: index('albums_share_link_token_idx').on(t.shareLinkToken),
  }
});

export const uploadStatusEnum = pgEnum('upload_status', ['pending', 'uploading', 'complete', 'failed']);

export const images = pgTable("images", {
  id: serial("id").primaryKey(),
  albumId: varchar("album_id", { length: 21 }).references(() => albums.id, { onDelete: "cascade" }),
  b2FileId: varchar("b2_file_id", { length: 255 }).notNull(),
  b2FileName: varchar("b2_file_name", { length: 500 }).notNull(),
  originalFilename: varchar("original_filename", { length: 255 }).notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  uploadOrder: integer("upload_order").notNull(),
  thumbnailB2FileId: varchar("thumbnail_b2_file_id", { length: 255 }),
  thumbnailB2FileName: varchar("thumbnail_b2_file_name", { length: 500 }),
  uploadStatus: uploadStatusEnum("upload_status").default('pending'),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => {
  return {
    albumIdIdx: index('images_album_id_idx').on(t.albumId),
    b2FileIdIdx: index('images_b2_file_id_idx').on(t.b2FileId),
    uploadOrderIdx: index('images_upload_order_idx').on(t.albumId, t.uploadOrder),
  }
});

export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  albumId: varchar("album_id", { length: 21 }).references(() => albums.id, { onDelete: "cascade" }),
  imageId: integer("image_id").references(() => images.id, { onDelete: "cascade" }),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => {
  return {
    favoritesUnique: unique('favorites_unique').on(t.albumId, t.imageId, t.clientName),
  }
});
