import { Router } from "express";
import { db } from "@workspace/db";
import {
  schedulesTable,
  coursesTable,
  facultyTable,
  roomsTable,
  timeslotsTable,
} from "@workspace/db";
import { eq, and, type SQL } from "drizzle-orm";
import {
  CreateScheduleBody,
  UpdateScheduleBody,
  GetScheduleParams,
  UpdateScheduleParams,
  DeleteScheduleParams,
  ListSchedulesQueryParams,
  GetConflictsQueryParams,
  GetAiSuggestionsBody,
  GenerateScheduleBody,
} from "@workspace/api-zod";

const router = Router();

async function getScheduleWithRelations(id: number) {
  const rows = await db
    .select()
    .from(schedulesTable)
    .leftJoin(coursesTable, eq(schedulesTable.courseId, coursesTable.id))
    .leftJoin(facultyTable, eq(schedulesTable.facultyId, facultyTable.id))
    .leftJoin(roomsTable, eq(schedulesTable.roomId, roomsTable.id))
    .leftJoin(timeslotsTable, eq(schedulesTable.timeslotId, timeslotsTable.id))
    .where(eq(schedulesTable.id, id));

  const row = rows[0];
  if (!row) return null;

  return {
    ...row.schedules,
    createdAt: row.schedules.createdAt.toISOString(),
    course: row.courses ? { ...row.courses, createdAt: row.courses.createdAt.toISOString() } : undefined,
    faculty: row.faculty ? { ...row.faculty, createdAt: row.faculty.createdAt.toISOString() } : undefined,
    room: row.rooms ? { ...row.rooms, createdAt: row.rooms.createdAt.toISOString() } : undefined,
    timeslot: row.timeslots ?? undefined,
  };
}

router.get("/schedules", async (req, res) => {
  const parsed = ListSchedulesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }

  const { semester, academicYear, facultyId, roomId, day } = parsed.data;
  const conditions: SQL[] = [];
  if (semester) conditions.push(eq(schedulesTable.semester, semester));
  if (academicYear) conditions.push(eq(schedulesTable.academicYear, academicYear));
  if (facultyId) conditions.push(eq(schedulesTable.facultyId, facultyId));
  if (roomId) conditions.push(eq(schedulesTable.roomId, roomId));

  const rows = await db
    .select()
    .from(schedulesTable)
    .leftJoin(coursesTable, eq(schedulesTable.courseId, coursesTable.id))
    .leftJoin(facultyTable, eq(schedulesTable.facultyId, facultyTable.id))
    .leftJoin(roomsTable, eq(schedulesTable.roomId, roomsTable.id))
    .leftJoin(timeslotsTable, eq(schedulesTable.timeslotId, timeslotsTable.id))
    .where(conditions.length ? and(...conditions) : undefined);

  let result = rows.map((row) => ({
    ...row.schedules,
    createdAt: row.schedules.createdAt.toISOString(),
    course: row.courses ? { ...row.courses, createdAt: row.courses.createdAt.toISOString() } : undefined,
    faculty: row.faculty ? { ...row.faculty, createdAt: row.faculty.createdAt.toISOString() } : undefined,
    room: row.rooms ? { ...row.rooms, createdAt: row.rooms.createdAt.toISOString() } : undefined,
    timeslot: row.timeslots ?? undefined,
  }));

  if (day) {
    result = result.filter((r) => r.timeslot?.day === day);
  }

  res.json(result);
});

router.get("/schedules/conflicts", async (req, res) => {
  const parsed = GetConflictsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }

  const { semester, academicYear } = parsed.data;
  const conditions: SQL[] = [];
  if (semester) conditions.push(eq(schedulesTable.semester, semester));
  if (academicYear) conditions.push(eq(schedulesTable.academicYear, academicYear));

  const rows = await db
    .select()
    .from(schedulesTable)
    .leftJoin(timeslotsTable, eq(schedulesTable.timeslotId, timeslotsTable.id))
    .leftJoin(facultyTable, eq(schedulesTable.facultyId, facultyTable.id))
    .leftJoin(coursesTable, eq(schedulesTable.courseId, coursesTable.id))
    .where(conditions.length ? and(...conditions) : undefined);

  const conflicts: Array<{
    id: number;
    type: "room_conflict" | "faculty_conflict" | "overload";
    severity: "error" | "warning";
    description: string;
    affectedScheduleIds: number[];
    suggestedFix?: string;
  }> = [];

  let conflictId = 1;

  // Room conflicts: same room at the same timeslot
  const roomTimeslotMap = new Map<string, number[]>();
  for (const row of rows) {
    const key = `${row.schedules.roomId}-${row.schedules.timeslotId}`;
    if (!roomTimeslotMap.has(key)) roomTimeslotMap.set(key, []);
    roomTimeslotMap.get(key)!.push(row.schedules.id);
  }
  for (const [, ids] of roomTimeslotMap) {
    if (ids.length > 1) {
      conflicts.push({
        id: conflictId++,
        type: "room_conflict",
        severity: "error",
        description: `Room double-booked: ${ids.length} classes scheduled in the same room at the same time.`,
        affectedScheduleIds: ids,
        suggestedFix: "Reassign one of the sections to a different room or time slot.",
      });
    }
  }

  // Faculty conflicts: same faculty at the same timeslot
  const facultyTimeslotMap = new Map<string, number[]>();
  for (const row of rows) {
    const key = `${row.schedules.facultyId}-${row.schedules.timeslotId}`;
    if (!facultyTimeslotMap.has(key)) facultyTimeslotMap.set(key, []);
    facultyTimeslotMap.get(key)!.push(row.schedules.id);
  }
  for (const [, ids] of facultyTimeslotMap) {
    if (ids.length > 1) {
      conflicts.push({
        id: conflictId++,
        type: "faculty_conflict",
        severity: "error",
        description: `Faculty scheduling conflict: faculty assigned to ${ids.length} classes at the same time.`,
        affectedScheduleIds: ids,
        suggestedFix: "Reassign one of the sections to a different faculty or time slot.",
      });
    }
  }

  // Faculty overload
  const facultyUnitMap = new Map<number, { units: number; scheduleIds: number[]; maxUnits: number; name: string }>();
  for (const row of rows) {
    const fId = row.schedules.facultyId;
    const units = row.courses?.units ?? 3;
    const maxUnits = row.faculty?.maxUnits ?? 21;
    const name = row.faculty?.name ?? "Unknown";
    if (!facultyUnitMap.has(fId)) {
      facultyUnitMap.set(fId, { units: 0, scheduleIds: [], maxUnits, name });
    }
    const entry = facultyUnitMap.get(fId)!;
    entry.units += units;
    entry.scheduleIds.push(row.schedules.id);
  }
  for (const [, entry] of facultyUnitMap) {
    if (entry.units > entry.maxUnits) {
      conflicts.push({
        id: conflictId++,
        type: "overload",
        severity: "warning",
        description: `Faculty overload: ${entry.name} has ${entry.units} units assigned, exceeding max load of ${entry.maxUnits}.`,
        affectedScheduleIds: entry.scheduleIds,
        suggestedFix: "Redistribute some courses to other faculty members with available load.",
      });
    }
  }

  res.json(conflicts);
});

router.post("/schedules/suggestions", async (req, res) => {
  const parsed = GetAiSuggestionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }

  const { semester, academicYear } = parsed.data;
  const conditions: SQL[] = [];
  if (semester) conditions.push(eq(schedulesTable.semester, semester));
  if (academicYear) conditions.push(eq(schedulesTable.academicYear, academicYear));

  const rows = await db
    .select()
    .from(schedulesTable)
    .leftJoin(coursesTable, eq(schedulesTable.courseId, coursesTable.id))
    .leftJoin(facultyTable, eq(schedulesTable.facultyId, facultyTable.id))
    .leftJoin(roomsTable, eq(schedulesTable.roomId, roomsTable.id))
    .leftJoin(timeslotsTable, eq(schedulesTable.timeslotId, timeslotsTable.id))
    .where(conditions.length ? and(...conditions) : undefined);

  const suggestions: Array<{
    id: number;
    type: "reassign_room" | "reassign_faculty" | "move_timeslot" | "split_section" | "merge_section";
    priority: "high" | "medium" | "low";
    title: string;
    description: string;
    affectedScheduleId?: number;
    proposedChanges?: string;
  }> = [];

  let suggId = 1;

  // Suggest rooms with low utilization
  const roomUsage = new Map<number, number>();
  for (const row of rows) {
    const rId = row.schedules.roomId;
    roomUsage.set(rId, (roomUsage.get(rId) ?? 0) + 1);
  }

  // Check capacity mismatches
  for (const row of rows) {
    const enrollment = row.courses?.enrollmentCount ?? 0;
    const capacity = row.rooms?.capacity ?? 0;
    if (capacity > 0 && enrollment < capacity * 0.4) {
      suggestions.push({
        id: suggId++,
        type: "reassign_room",
        priority: "low",
        title: `Downsize room for ${row.courses?.code ?? "course"}`,
        description: `${row.courses?.name ?? "Course"} (enrollment: ${enrollment}) is in ${row.rooms?.roomNumber ?? "room"} (capacity: ${capacity}). The room is underutilized.`,
        affectedScheduleId: row.schedules.id,
        proposedChanges: `Move to a smaller room to free up this room for larger sections.`,
      });
    }
    if (capacity > 0 && enrollment > capacity) {
      suggestions.push({
        id: suggId++,
        type: "reassign_room",
        priority: "high",
        title: `Upgrade room for ${row.courses?.code ?? "course"}`,
        description: `${row.courses?.name ?? "Course"} (enrollment: ${enrollment}) exceeds capacity of ${row.rooms?.roomNumber ?? "room"} (${capacity}).`,
        affectedScheduleId: row.schedules.id,
        proposedChanges: `Move to a larger room or split the section.`,
      });
    }
  }

  // Faculty load balance suggestions
  const facultyLoad = new Map<number, { units: number; name: string; maxUnits: number; schedIds: number[] }>();
  for (const row of rows) {
    const fId = row.schedules.facultyId;
    const units = row.courses?.units ?? 3;
    if (!facultyLoad.has(fId)) {
      facultyLoad.set(fId, {
        units: 0,
        name: row.faculty?.name ?? "Unknown",
        maxUnits: row.faculty?.maxUnits ?? 21,
        schedIds: [],
      });
    }
    const entry = facultyLoad.get(fId)!;
    entry.units += units;
    entry.schedIds.push(row.schedules.id);
  }

  const overloaded = [...facultyLoad.entries()].filter(([, e]) => e.units > e.maxUnits);
  const underloaded = [...facultyLoad.entries()].filter(([, e]) => e.units < e.maxUnits * 0.5);

  for (const [, entry] of overloaded) {
    if (underloaded.length > 0) {
      const [, uEntry] = underloaded[0];
      suggestions.push({
        id: suggId++,
        type: "reassign_faculty",
        priority: "high",
        title: `Rebalance load from ${entry.name}`,
        description: `${entry.name} has ${entry.units} units (max: ${entry.maxUnits}). Consider redistributing to ${uEntry.name} who has ${uEntry.units} units.`,
        proposedChanges: `Reassign one or more courses from ${entry.name} to ${uEntry.name}.`,
      });
    }
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: suggId++,
      type: "move_timeslot",
      priority: "low",
      title: "Schedule looks balanced",
      description: "No major conflicts or inefficiencies detected in the current schedule.",
    });
  }

  res.json({
    suggestions,
    summary: `Found ${suggestions.length} suggestion(s) for the ${semester} ${academicYear} schedule. ${overloaded.length} faculty overload(s) detected.`,
  });
});

router.post("/schedules/generate", async (req, res) => {
  const parsed = GenerateScheduleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }

  const { semester, academicYear, courseIds } = parsed.data;

  const [allTimeslots, allRooms, allFaculty, existingSchedules] = await Promise.all([
    db.select().from(timeslotsTable),
    db.select().from(roomsTable),
    db.select().from(facultyTable),
    db.select().from(schedulesTable).where(
      and(eq(schedulesTable.semester, semester), eq(schedulesTable.academicYear, academicYear))
    ),
  ]);

  const courses = await db
    .select()
    .from(coursesTable)
    .where(
      courseIds.length
        ? and(...courseIds.map((id) => eq(coursesTable.id, id)))
        : undefined
    );

  if (!allTimeslots.length || !allRooms.length || !allFaculty.length) {
    res.status(400).json({ error: "Bad Request", message: "Not enough resources to generate a schedule. Please add time slots, rooms, and faculty." });
    return;
  }

  // Track usage
  const usedRoomTimeslots = new Set(existingSchedules.map((s) => `${s.roomId}-${s.timeslotId}`));
  const usedFacultyTimeslots = new Set(existingSchedules.map((s) => `${s.facultyId}-${s.timeslotId}`));
  const facultyUnits = new Map<number, number>();
  for (const f of allFaculty) facultyUnits.set(f.id, 0);
  for (const s of existingSchedules) {
    const c = courses.find((c) => c.id === s.courseId);
    if (c) {
      facultyUnits.set(s.facultyId, (facultyUnits.get(s.facultyId) ?? 0) + c.units);
    }
  }

  const generated: typeof schedulesTable.$inferSelect[] = [];
  const conflicts: Array<{ id: number; type: string; severity: string; description: string; affectedScheduleIds: number[]; suggestedFix?: string }> = [];
  let conflictId = 1;

  for (const course of courses) {
    // Find a suitable room
    const suitableRooms = allRooms.filter((r) => r.capacity >= course.enrollmentCount);
    const suitableTimeslots = allTimeslots;

    let assigned = false;
    for (const timeslot of suitableTimeslots) {
      for (const room of (suitableRooms.length ? suitableRooms : allRooms)) {
        if (usedRoomTimeslots.has(`${room.id}-${timeslot.id}`)) continue;

        // Find available faculty
        const availableFaculty = allFaculty.filter((f) => {
          if (usedFacultyTimeslots.has(`${f.id}-${timeslot.id}`)) return false;
          const currentUnits = facultyUnits.get(f.id) ?? 0;
          return currentUnits + course.units <= f.maxUnits;
        });

        if (!availableFaculty.length) continue;

        const faculty = availableFaculty[0];

        const [newSchedule] = await db
          .insert(schedulesTable)
          .values({ courseId: course.id, facultyId: faculty.id, roomId: room.id, timeslotId: timeslot.id, semester, academicYear })
          .returning();

        usedRoomTimeslots.add(`${room.id}-${timeslot.id}`);
        usedFacultyTimeslots.add(`${faculty.id}-${timeslot.id}`);
        facultyUnits.set(faculty.id, (facultyUnits.get(faculty.id) ?? 0) + course.units);
        generated.push(newSchedule);
        assigned = true;
        break;
      }
      if (assigned) break;
    }

    if (!assigned) {
      conflicts.push({
        id: conflictId++,
        type: "room_conflict",
        severity: "warning",
        description: `Could not assign ${course.code} - ${course.name}. No available room-timeslot combination found.`,
        affectedScheduleIds: [],
        suggestedFix: "Add more time slots or rooms, or adjust faculty availability.",
      });
    }
  }

  const schedulesWithRelations = await Promise.all(generated.map((s) => getScheduleWithRelations(s.id)));

  res.json({
    generatedCount: generated.length,
    schedules: schedulesWithRelations.filter(Boolean),
    conflicts,
    summary: `Generated ${generated.length} of ${courses.length} schedule entries. ${conflicts.length} course(s) could not be assigned.`,
  });
});

router.post("/schedules", async (req, res) => {
  const parsed = CreateScheduleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }

  // Check for room conflict
  const [roomConflict] = await db
    .select()
    .from(schedulesTable)
    .where(
      and(
        eq(schedulesTable.roomId, parsed.data.roomId),
        eq(schedulesTable.timeslotId, parsed.data.timeslotId),
        eq(schedulesTable.semester, parsed.data.semester),
        eq(schedulesTable.academicYear, parsed.data.academicYear)
      )
    );

  if (roomConflict) {
    res.status(409).json({ error: "Conflict", message: "Room is already booked for this time slot." });
    return;
  }

  // Check for faculty conflict
  const [facultyConflict] = await db
    .select()
    .from(schedulesTable)
    .where(
      and(
        eq(schedulesTable.facultyId, parsed.data.facultyId),
        eq(schedulesTable.timeslotId, parsed.data.timeslotId),
        eq(schedulesTable.semester, parsed.data.semester),
        eq(schedulesTable.academicYear, parsed.data.academicYear)
      )
    );

  if (facultyConflict) {
    res.status(409).json({ error: "Conflict", message: "Faculty member is already scheduled for this time slot." });
    return;
  }

  const [created] = await db.insert(schedulesTable).values(parsed.data).returning();
  const full = await getScheduleWithRelations(created.id);
  res.status(201).json(full);
});

router.get("/schedules/:id", async (req, res) => {
  const parsed = GetScheduleParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const entry = await getScheduleWithRelations(parsed.data.id);
  if (!entry) {
    res.status(404).json({ error: "Not Found", message: "Schedule entry not found" });
    return;
  }
  res.json(entry);
});

router.put("/schedules/:id", async (req, res) => {
  const paramsParsed = UpdateScheduleParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Bad Request", message: paramsParsed.error.message });
    return;
  }
  const bodyParsed = UpdateScheduleBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Bad Request", message: bodyParsed.error.message });
    return;
  }
  const [updated] = await db
    .update(schedulesTable)
    .set(bodyParsed.data)
    .where(eq(schedulesTable.id, paramsParsed.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not Found", message: "Schedule entry not found" });
    return;
  }
  const full = await getScheduleWithRelations(updated.id);
  res.json(full);
});

router.delete("/schedules/:id", async (req, res) => {
  const parsed = DeleteScheduleParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const [deleted] = await db.delete(schedulesTable).where(eq(schedulesTable.id, parsed.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Not Found", message: "Schedule entry not found" });
    return;
  }
  res.json({ success: true, message: "Schedule entry deleted" });
});

export default router;
