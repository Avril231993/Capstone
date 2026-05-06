import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { facultyTable } from "./faculty";

export const facultySpecializationsTable = pgTable("faculty_specializations", {
  id: serial("id").primaryKey(),
  facultyId: integer("faculty_id").notNull().references(() => facultyTable.id, { onDelete: "cascade" }),
  subjectArea: text("subject_area").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  yearsExperience: integer("years_experience"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFacultySpecializationSchema = createInsertSchema(facultySpecializationsTable).omit({ id: true, createdAt: true });
export type InsertFacultySpecialization = z.infer<typeof insertFacultySpecializationSchema>;
export type FacultySpecialization = typeof facultySpecializationsTable.$inferSelect;
