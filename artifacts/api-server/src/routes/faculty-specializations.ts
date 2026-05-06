import { Router } from "express";
import { db } from "@workspace/db";
import { facultySpecializationsTable, facultyAvailabilityTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const CreateSpecBody = z.object({
  subjectArea: z.string().min(1),
  isPrimary: z.boolean().optional().default(false),
  yearsExperience: z.coerce.number().int().optional(),
});

function serializeSpec(row: typeof facultySpecializationsTable.$inferSelect) {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

function serializeAvail(row: typeof facultyAvailabilityTable.$inferSelect) {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

router.get("/faculty/:id/specializations", async (req, res) => {
  const facultyId = Number(req.params.id);
  const rows = await db
    .select()
    .from(facultySpecializationsTable)
    .where(eq(facultySpecializationsTable.facultyId, facultyId))
    .orderBy(facultySpecializationsTable.isPrimary);
  res.json(rows.map(serializeSpec));
});

router.post("/faculty/:id/specializations", async (req, res) => {
  const facultyId = Number(req.params.id);
  const parsed = CreateSpecBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(facultySpecializationsTable)
    .values({ facultyId, ...parsed.data })
    .returning();
  res.status(201).json(serializeSpec(row));
});

router.delete("/faculty/:id/specializations/:specId", async (req, res) => {
  const facultyId = Number(req.params.id);
  const specId = Number(req.params.specId);
  const [row] = await db
    .delete(facultySpecializationsTable)
    .where(and(
      eq(facultySpecializationsTable.id, specId),
      eq(facultySpecializationsTable.facultyId, facultyId)
    ))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

router.get("/faculty/:id/availability", async (req, res) => {
  const facultyId = Number(req.params.id);
  const rows = await db
    .select()
    .from(facultyAvailabilityTable)
    .where(eq(facultyAvailabilityTable.facultyId, facultyId))
    .orderBy(facultyAvailabilityTable.day);
  res.json(rows.map(serializeAvail));
});

export default router;
