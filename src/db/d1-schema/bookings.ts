import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { user } from './auth';

export const bookings = sqliteTable("bookings", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    photographerId: text("photographer_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
    eventType: text("event_type", { length: 100 }).notNull(),
    name: text("name", { length: 255 }).notNull(),
    phone: text("phone", { length: 20 }).notNull(),
    eventDate: text("event_date").notNull(), // date -> text (ISO date string YYYY-MM-DD)
    location: text("location", { length: 500 }).notNull(),
    details: text("details"),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
}, (t) => {
    return {
        photographerIdIdx: index('bookings_photographer_id_idx').on(t.photographerId),
        eventDateIdx: index('bookings_event_date_idx').on(t.eventDate),
    }
});
