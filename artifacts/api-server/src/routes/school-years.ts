import { Router } from "express";
import { db } from "@workspace/db";
import { schoolYearsTable, yearLevelsTable, sectionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const CreateSchoolYearBody = z.object({
  name: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const ArchiveBody = z.object({
  schoolYearId: z.coerce.number().int(),
  newSchoolYearName: z.string().min(1),
});

router.get("/school-years", async (req, res) => {
  const rows = await db.select().from(schoolYearsTable).orderBy(schoolYearsTable.createdAt);
  res.json(rows.map(r => ({
    ...r,
    archivedAt: r.archivedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  })));
});

router.post("/school-years", async (req, res) => {
  const parsed = CreateSchoolYearBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad Request", message: parsed.error.message }); return; }
  const [row] = await db.insert(schoolYearsTable).values({ ...parsed.data, status: "active" }).returning();
  res.status(201).json({ ...row, archivedAt: null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
});

router.post("/school-years/archive", async (req, res) => {
  const parsed = ArchiveBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad Request", message: parsed.error.message }); return; }
  const { schoolYearId, newSchoolYearName } = parsed.data;

  const existing = await db.select().from(schoolYearsTable).where(eq(schoolYearsTable.id, schoolYearId));
  if (!existing[0]) { res.status(404).json({ error: "School year not found" }); return; }

  const [archived] = await db
    .update(schoolYearsTable)
    .set({ status: "archived", archivedAt: new Date() })
    .where(eq(schoolYearsTable.id, schoolYearId))
    .returning();

  const [newYear] = await db.insert(schoolYearsTable).values({ name: newSchoolYearName, status: "active" }).returning();

  res.json({
    archived: { ...archived, archivedAt: archived.archivedAt?.toISOString(), createdAt: archived.createdAt.toISOString(), updatedAt: archived.updatedAt.toISOString() },
    newSchoolYear: { ...newYear, archivedAt: null, createdAt: newYear.createdAt.toISOString(), updatedAt: newYear.updatedAt.toISOString() },
    message: `School year ${existing[0].name} archived. New year ${newSchoolYearName} initialized.`,
  });
});

router.delete("/school-years/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.delete(schoolYearsTable).where(eq(schoolYearsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

export default router;
