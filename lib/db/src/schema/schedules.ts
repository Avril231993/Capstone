import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coursesTable } from "./courses";
import { facultyTable } from "./faculty";
import { roomsTable } from "./rooms";
import { timeslotsTable } from "./timeslots";

export const schedulesTable = pgTable("schedules", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  facultyId: integer("faculty_id").notNull().references(() => facultyTable.id, { onDelete: "cascade" }),
  roomId: integer("room_id").notNull().references(() => roomsTable.id, { onDelete: "cascade" }),
  timeslotId: integer("timeslot_id").notNull().references(() => timeslotsTable.id, { onDelete: "cascade" }),
  semester: text("semester").notNull(),
  academicYear: text("academic_year").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertScheduleSchema = createInsertSchema(schedulesTable).omit({ id: true, createdAt: true });
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof schedulesTable.$inferSelect;
