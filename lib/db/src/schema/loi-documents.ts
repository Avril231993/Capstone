import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { facultyTable } from "./faculty";

export const loiDocumentsTable = pgTable("loi_documents", {
  id: serial("id").primaryKey(),
  facultyId: integer("faculty_id").references(() => facultyTable.id, { onDelete: "set null" }),
  originalText: text("original_text").notNull(),
  fileName: text("file_name"),
  status: text("status").notNull().default("pending"),
  extractedData: jsonb("extracted_data"),
  processingError: text("processing_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLoiDocumentSchema = createInsertSchema(loiDocumentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLoiDocument = z.infer<typeof insertLoiDocumentSchema>;
export type LoiDocument = typeof loiDocumentsTable.$inferSelect;
