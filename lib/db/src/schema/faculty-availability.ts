import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { facultyTable } from "./faculty";

export const facultyAvailabilityTable = pgTable("faculty_availability", {
  id: serial("id").primaryKey(),
  facultyId: integer("faculty_id").notNull().references(() => facultyTable.id, { onDelete: "cascade" }),
  day: text("day").notNull(),
  timeOfDay: text("time_of_day").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  employmentType: text("employment_type").notNull().default("full_time"),
  sourceLoiId: integer("source_loi_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFacultyAvailabilitySchema = createInsertSchema(facultyAvailabilityTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFacultyAvailability = z.infer<typeof insertFacultyAvailabilitySchema>;
export type FacultyAvailability = typeof facultyAvailabilityTable.$inferSelect;
