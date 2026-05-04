import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roomTypeEnum = ["lecture", "lab", "computer", "seminar", "gym"] as const;

export const roomsTable = pgTable("rooms", {
  id: serial("id").primaryKey(),
  roomNumber: text("room_number").notNull(),
  building: text("building").notNull(),
  capacity: integer("capacity").notNull(),
  type: text("type").notNull().$type<typeof roomTypeEnum[number]>(),
  features: text("features"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRoomSchema = createInsertSchema(roomsTable).omit({ id: true, createdAt: true });
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof roomsTable.$inferSelect;
