import { Router } from "express";
import { db } from "@workspace/db";
import { roomsTable } from "@workspace/db";
import { eq, gte, and, type SQL } from "drizzle-orm";
import {
  CreateRoomBody,
  UpdateRoomBody,
  GetRoomParams,
  UpdateRoomParams,
  DeleteRoomParams,
  ListRoomsQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/rooms", async (req, res) => {
  const parsed = ListRoomsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const { type, minCapacity } = parsed.data;
  const conditions: SQL[] = [];
  if (type) conditions.push(eq(roomsTable.type, type));
  if (minCapacity !== undefined) conditions.push(gte(roomsTable.capacity, minCapacity));
  const rooms = await db.select().from(roomsTable).where(conditions.length ? and(...conditions) : undefined);
  res.json(rooms.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/rooms", async (req, res) => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const [created] = await db.insert(roomsTable).values(parsed.data).returning();
  res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
});

router.get("/rooms/:id", async (req, res) => {
  const parsed = GetRoomParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, parsed.data.id));
  if (!room) {
    res.status(404).json({ error: "Not Found", message: "Room not found" });
    return;
  }
  res.json({ ...room, createdAt: room.createdAt.toISOString() });
});

router.put("/rooms/:id", async (req, res) => {
  const paramsParsed = UpdateRoomParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Bad Request", message: paramsParsed.error.message });
    return;
  }
  const bodyParsed = UpdateRoomBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Bad Request", message: bodyParsed.error.message });
    return;
  }
  const [updated] = await db
    .update(roomsTable)
    .set(bodyParsed.data)
    .where(eq(roomsTable.id, paramsParsed.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not Found", message: "Room not found" });
    return;
  }
  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

router.delete("/rooms/:id", async (req, res) => {
  const parsed = DeleteRoomParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const [deleted] = await db.delete(roomsTable).where(eq(roomsTable.id, parsed.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Not Found", message: "Room not found" });
    return;
  }
  res.json({ success: true, message: "Room deleted" });
});

export default router;
