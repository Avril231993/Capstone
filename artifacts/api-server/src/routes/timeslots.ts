import { Router } from "express";
import { db } from "@workspace/db";
import { timeslotsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateTimeslotBody, DeleteTimeslotParams } from "@workspace/api-zod";

const router = Router();

router.get("/timeslots", async (_req, res) => {
  const timeslots = await db.select().from(timeslotsTable).orderBy(timeslotsTable.day, timeslotsTable.startTime);
  res.json(timeslots);
});

router.post("/timeslots", async (req, res) => {
  const parsed = CreateTimeslotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const [created] = await db.insert(timeslotsTable).values(parsed.data).returning();
  res.status(201).json(created);
});

router.delete("/timeslots/:id", async (req, res) => {
  const parsed = DeleteTimeslotParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const [deleted] = await db.delete(timeslotsTable).where(eq(timeslotsTable.id, parsed.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Not Found", message: "Timeslot not found" });
    return;
  }
  res.json({ success: true, message: "Timeslot deleted" });
});

export default router;
