import { pgTable, serial, text, varchar, timestamp, index, date } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const bookings = pgTable("bookings", {
    id: serial("id").primaryKey(),
    photographerId: text("photographer_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    eventDate: date("event_date").notNull(),
    location: varchar("location", { length: 500 }).notNull(),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => {
    return {
        photographerIdIdx: index('bookings_photographer_id_idx').on(t.photographerId),
        eventDateIdx: index('bookings_event_date_idx').on(t.eventDate),
    }
});
