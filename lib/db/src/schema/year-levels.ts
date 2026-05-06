import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { schoolYearsTable } from "./school-years";

export const yearLevelsTable = pgTable("year_levels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  sectionCount: integer("section_count").notNull().default(1),
  schoolYearId: integer("school_year_id").references(() => schoolYearsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertYearLevelSchema = createInsertSchema(yearLevelsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertYearLevel = z.infer<typeof insertYearLevelSchema>;
export type YearLevel = typeof yearLevelsTable.$inferSelect;
