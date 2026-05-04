import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const facultyRankEnum = ["instructor", "assistant_professor", "associate_professor", "professor", "part_time"] as const;

export const facultyTable = pgTable("faculty", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  department: text("department").notNull(),
  specialization: text("specialization"),
  rank: text("rank").notNull().$type<typeof facultyRankEnum[number]>(),
  maxUnits: integer("max_units").notNull().default(21),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFacultySchema = createInsertSchema(facultyTable).omit({ id: true, createdAt: true });
export type InsertFaculty = z.infer<typeof insertFacultySchema>;
export type FacultyMember = typeof facultyTable.$inferSelect;
