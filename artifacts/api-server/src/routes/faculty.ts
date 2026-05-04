import { Router } from "express";
import { db } from "@workspace/db";
import { facultyTable } from "@workspace/db";
import { eq, ilike, and, type SQL } from "drizzle-orm";
import {
  CreateFacultyBody,
  UpdateFacultyBody,
  GetFacultyParams,
  UpdateFacultyParams,
  DeleteFacultyParams,
  ListFacultyQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/faculty", async (req, res) => {
  const parsed = ListFacultyQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const { department, search } = parsed.data;
  const conditions: SQL[] = [];
  if (department) conditions.push(eq(facultyTable.department, department));
  if (search) conditions.push(ilike(facultyTable.name, `%${search}%`));
  const faculty = await db.select().from(facultyTable).where(conditions.length ? and(...conditions) : undefined);
  res.json(faculty.map(f => ({ ...f, createdAt: f.createdAt.toISOString() })));
});

router.post("/faculty", async (req, res) => {
  const parsed = CreateFacultyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const [created] = await db.insert(facultyTable).values(parsed.data).returning();
  res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
});

router.get("/faculty/:id", async (req, res) => {
  const parsed = GetFacultyParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const [member] = await db.select().from(facultyTable).where(eq(facultyTable.id, parsed.data.id));
  if (!member) {
    res.status(404).json({ error: "Not Found", message: "Faculty member not found" });
    return;
  }
  res.json({ ...member, createdAt: member.createdAt.toISOString() });
});

router.put("/faculty/:id", async (req, res) => {
  const paramsParsed = UpdateFacultyParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Bad Request", message: paramsParsed.error.message });
    return;
  }
  const bodyParsed = UpdateFacultyBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Bad Request", message: bodyParsed.error.message });
    return;
  }
  const [updated] = await db
    .update(facultyTable)
    .set(bodyParsed.data)
    .where(eq(facultyTable.id, paramsParsed.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not Found", message: "Faculty member not found" });
    return;
  }
  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

router.delete("/faculty/:id", async (req, res) => {
  const parsed = DeleteFacultyParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const [deleted] = await db.delete(facultyTable).where(eq(facultyTable.id, parsed.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Not Found", message: "Faculty member not found" });
    return;
  }
  res.json({ success: true, message: "Faculty member deleted" });
});

export default router;
