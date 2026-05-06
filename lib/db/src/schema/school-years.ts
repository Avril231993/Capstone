import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const schoolYearsTable = pgTable("school_years", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  status: text("status").notNull().default("active"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSchoolYearSchema = createInsertSchema(schoolYearsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSchoolYear = z.infer<typeof insertSchoolYearSchema>;
export type SchoolYear = typeof schoolYearsTable.$inferSelect;
