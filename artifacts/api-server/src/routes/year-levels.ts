import { Router } from "express";
import { db } from "@workspace/db";
import { yearLevelsTable, sectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const CreateYearLevelBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sectionCount: z.coerce.number().int().min(1).default(1),
  schoolYearId: z.coerce.number().int().optional(),
});

const UpdateYearLevelBody = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  sectionCount: z.coerce.number().int().min(1).optional(),
});

async function generateSections(yearLevelId: number, count: number, levelName: string) {
  const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  const values = Array.from({ length: count }, (_, i) => ({
    name: `${levelName} - ${LABELS[i] ?? i + 1}`,
    yearLevelId,
    capacity: 40,
  }));
  await db.insert(sectionsTable).values(values);
}

router.get("/year-levels", async (req, res) => {
  const levels = await db.select().from(yearLevelsTable).orderBy(yearLevelsTable.createdAt);
  const sections = await db.select().from(sectionsTable);

  const result = levels.map(l => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    sections: sections
      .filter(s => s.yearLevelId === l.id)
      .map(s => ({ ...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() })),
  }));
  res.json(result);
});

router.post("/year-levels", async (req, res) => {
  const parsed = CreateYearLevelBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad Request", message: parsed.error.message }); return; }

  const { sectionCount, ...rest } = parsed.data;
  const [level] = await db.insert(yearLevelsTable).values({ ...rest, sectionCount }).returning();
  await generateSections(level.id, sectionCount, level.name);

  const sections = await db.select().from(sectionsTable).where(eq(sectionsTable.yearLevelId, level.id));
  res.status(201).json({
    ...level,
    createdAt: level.createdAt.toISOString(),
    updatedAt: level.updatedAt.toISOString(),
    sections: sections.map(s => ({ ...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() })),
  });
});

router.put("/year-levels/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateYearLevelBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad Request", message: parsed.error.message }); return; }

  const [level] = await db.update(yearLevelsTable).set(parsed.data).where(eq(yearLevelsTable.id, id)).returning();
  if (!level) { res.status(404).json({ error: "Not found" }); return; }

  if (parsed.data.sectionCount !== undefined) {
    const existing = await db.select().from(sectionsTable).where(eq(sectionsTable.yearLevelId, id));
    const diff = parsed.data.sectionCount - existing.length;
    if (diff > 0) {
      await generateSections(id, diff, level.name);
    } else if (diff < 0) {
      const toRemove = existing.slice(diff);
      for (const s of toRemove) {
        await db.delete(sectionsTable).where(eq(sectionsTable.id, s.id));
      }
    }
  }

  const sections = await db.select().from(sectionsTable).where(eq(sectionsTable.yearLevelId, id));
  res.json({
    ...level,
    createdAt: level.createdAt.toISOString(),
    updatedAt: level.updatedAt.toISOString(),
    sections: sections.map(s => ({ ...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() })),
  });
});

router.delete("/year-levels/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.delete(yearLevelsTable).where(eq(yearLevelsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

export default router;
