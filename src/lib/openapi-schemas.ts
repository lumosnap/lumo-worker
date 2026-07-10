import { z } from "@hono/zod-openapi";

// Standard error/success envelope shared across every route response schema.
export const errorResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Comment shape returned for favorite images (album + public routes).
export const commentSchema = z.object({
  clientName: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});

// Booking shape returned for photographers (profile + public routes).
export const bookingSchema = z.object({
  id: z.number(),
  photographerId: z.string(),
  eventType: z.string(),
  name: z.string(),
  phone: z.string(),
  eventDate: z.string(),
  location: z.string(),
  details: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Base plan shape (plans + admin/plans routes). Admin extends with isActive.
export const PlanSchema = z.object({
  id: z.number(),
  name: z.string(),
  displayName: z.string(),
  imageLimit: z.number(),
  priceMonthly: z.union([z.string(), z.number()]).transform((val) => String(val)),
  description: z.string().nullable().optional(),
});
