import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dayEnum = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const timeslotsTable = pgTable("timeslots", {
  id: serial("id").primaryKey(),
  day: text("day").notNull().$type<typeof dayEnum[number]>(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTimeslotSchema = createInsertSchema(timeslotsTable).omit({ id: true, createdAt: true });
export type InsertTimeslot = z.infer<typeof insertTimeslotSchema>;
export type Timeslot = typeof timeslotsTable.$inferSelect;
