import { Router } from "express";
import { db } from "@workspace/db";
import { coursesTable } from "@workspace/db";
import { eq, ilike, and, type SQL } from "drizzle-orm";
import {
  CreateCourseBody,
  UpdateCourseBody,
  GetCourseParams,
  UpdateCourseParams,
  DeleteCourseParams,
  ListCoursesQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/courses", async (req, res) => {
  const parsed = ListCoursesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const { department, search } = parsed.data;
  const conditions: SQL[] = [];
  if (department) conditions.push(eq(coursesTable.department, department));
  if (search) conditions.push(ilike(coursesTable.name, `%${search}%`));
  const courses = await db.select().from(coursesTable).where(conditions.length ? and(...conditions) : undefined);
  res.json(courses.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

router.post("/courses", async (req, res) => {
  const parsed = CreateCourseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const [created] = await db.insert(coursesTable).values(parsed.data).returning();
  res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
});

router.get("/courses/:id", async (req, res) => {
  const parsed = GetCourseParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, parsed.data.id));
  if (!course) {
    res.status(404).json({ error: "Not Found", message: "Course not found" });
    return;
  }
  res.json({ ...course, createdAt: course.createdAt.toISOString() });
});

router.put("/courses/:id", async (req, res) => {
  const paramsParsed = UpdateCourseParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Bad Request", message: paramsParsed.error.message });
    return;
  }
  const bodyParsed = UpdateCourseBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Bad Request", message: bodyParsed.error.message });
    return;
  }
  const [updated] = await db
    .update(coursesTable)
    .set(bodyParsed.data)
    .where(eq(coursesTable.id, paramsParsed.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not Found", message: "Course not found" });
    return;
  }
  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

router.delete("/courses/:id", async (req, res) => {
  const parsed = DeleteCourseParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const [deleted] = await db.delete(coursesTable).where(eq(coursesTable.id, parsed.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Not Found", message: "Course not found" });
    return;
  }
  res.json({ success: true, message: "Course deleted" });
});

export default router;
