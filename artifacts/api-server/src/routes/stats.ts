import { Router } from "express";
import { db } from "@workspace/db";
import { schedulesTable, coursesTable, facultyTable, roomsTable, timeslotsTable } from "@workspace/db";
import { eq, and, type SQL } from "drizzle-orm";
import { GetStatsOverviewQueryParams, GetFacultyLoadsQueryParams, GetRoomUtilizationQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/stats/overview", async (req, res) => {
  const parsed = GetStatsOverviewQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }

  const { semester, academicYear } = parsed.data;

  const [totalCoursesRes, totalFacultyRes, totalRoomsRes] = await Promise.all([
    db.select().from(coursesTable),
    db.select().from(facultyTable),
    db.select().from(roomsTable),
  ]);

  const conditions: SQL[] = [];
  if (semester) conditions.push(eq(schedulesTable.semester, semester));
  if (academicYear) conditions.push(eq(schedulesTable.academicYear, academicYear));

  const allSchedules = await db
    .select()
    .from(schedulesTable)
    .leftJoin(coursesTable, eq(schedulesTable.courseId, coursesTable.id))
    .leftJoin(facultyTable, eq(schedulesTable.facultyId, facultyTable.id))
    .leftJoin(timeslotsTable, eq(schedulesTable.timeslotId, timeslotsTable.id))
    .where(conditions.length ? and(...conditions) : undefined);

  const scheduledCourseIds = new Set(allSchedules.map((s) => s.schedules.courseId));
  const totalCourses = totalCoursesRes.length;
  const scheduledSections = scheduledCourseIds.size;
  const unscheduledSections = totalCourses - scheduledSections;

  // Detect conflicts
  const roomTimeslotMap = new Map<string, number[]>();
  const facultyTimeslotMap = new Map<string, number[]>();
  const facultyUnits = new Map<number, number>();

  for (const row of allSchedules) {
    const rtKey = `${row.schedules.roomId}-${row.schedules.timeslotId}`;
    const ftKey = `${row.schedules.facultyId}-${row.schedules.timeslotId}`;
    if (!roomTimeslotMap.has(rtKey)) roomTimeslotMap.set(rtKey, []);
    if (!facultyTimeslotMap.has(ftKey)) facultyTimeslotMap.set(ftKey, []);
    roomTimeslotMap.get(rtKey)!.push(row.schedules.id);
    facultyTimeslotMap.get(ftKey)!.push(row.schedules.id);

    const fId = row.schedules.facultyId;
    const units = row.courses?.units ?? 3;
    facultyUnits.set(fId, (facultyUnits.get(fId) ?? 0) + units);
  }

  let totalConflicts = 0;
  for (const [, ids] of roomTimeslotMap) if (ids.length > 1) totalConflicts++;
  for (const [, ids] of facultyTimeslotMap) if (ids.length > 1) totalConflicts++;

  let overloadedFaculty = 0;
  for (const f of totalFacultyRes) {
    const assigned = facultyUnits.get(f.id) ?? 0;
    if (assigned > f.maxUnits) overloadedFaculty++;
  }

  const totalSlots = totalRoomsRes.length * (await db.select().from(timeslotsTable)).length;
  const roomUtilizationRate = totalSlots > 0 ? (allSchedules.length / totalSlots) * 100 : 0;

  const totalFacultyUnits = totalFacultyRes.reduce((acc, f) => acc + f.maxUnits, 0);
  const assignedFacultyUnits = [...facultyUnits.values()].reduce((a, b) => a + b, 0);
  const facultyLoadRate = totalFacultyUnits > 0 ? (assignedFacultyUnits / totalFacultyUnits) * 100 : 0;

  res.json({
    totalCourses,
    totalFaculty: totalFacultyRes.length,
    totalRooms: totalRoomsRes.length,
    scheduledSections,
    unscheduledSections,
    totalConflicts,
    overloadedFaculty,
    roomUtilizationRate: Math.round(roomUtilizationRate * 10) / 10,
    facultyLoadRate: Math.round(facultyLoadRate * 10) / 10,
  });
});

router.get("/stats/faculty-loads", async (req, res) => {
  const parsed = GetFacultyLoadsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }

  const { semester, academicYear } = parsed.data;
  const conditions: SQL[] = [];
  if (semester) conditions.push(eq(schedulesTable.semester, semester));
  if (academicYear) conditions.push(eq(schedulesTable.academicYear, academicYear));

  const allFaculty = await db.select().from(facultyTable);
  const scheduleRows = await db
    .select()
    .from(schedulesTable)
    .leftJoin(coursesTable, eq(schedulesTable.courseId, coursesTable.id))
    .where(conditions.length ? and(...conditions) : undefined);

  const facultyMap = new Map<number, { units: number; courses: string[] }>();
  for (const f of allFaculty) facultyMap.set(f.id, { units: 0, courses: [] });

  for (const row of scheduleRows) {
    const fId = row.schedules.facultyId;
    const units = row.courses?.units ?? 3;
    const courseName = row.courses?.code ?? "Unknown";
    if (facultyMap.has(fId)) {
      const entry = facultyMap.get(fId)!;
      entry.units += units;
      entry.courses.push(courseName);
    }
  }

  const reports = allFaculty.map((f) => {
    const load = facultyMap.get(f.id) ?? { units: 0, courses: [] };
    const loadPercentage = f.maxUnits > 0 ? Math.round((load.units / f.maxUnits) * 1000) / 10 : 0;
    let status: "underloaded" | "normal" | "overloaded" = "normal";
    if (load.units < f.maxUnits * 0.5) status = "underloaded";
    if (load.units > f.maxUnits) status = "overloaded";

    return {
      facultyId: f.id,
      facultyName: f.name,
      department: f.department,
      rank: f.rank,
      maxUnits: f.maxUnits,
      assignedUnits: load.units,
      loadPercentage,
      status,
      courses: load.courses,
    };
  });

  res.json(reports);
});

router.get("/stats/room-utilization", async (req, res) => {
  const parsed = GetRoomUtilizationQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }

  const { semester, academicYear } = parsed.data;
  const conditions: SQL[] = [];
  if (semester) conditions.push(eq(schedulesTable.semester, semester));
  if (academicYear) conditions.push(eq(schedulesTable.academicYear, academicYear));

  const allRooms = await db.select().from(roomsTable);
  const totalTimeslots = (await db.select().from(timeslotsTable)).length;

  const scheduleRows = await db
    .select()
    .from(schedulesTable)
    .where(conditions.length ? and(...conditions) : undefined);

  const roomUsage = new Map<number, number>();
  for (const s of scheduleRows) {
    roomUsage.set(s.roomId, (roomUsage.get(s.roomId) ?? 0) + 1);
  }

  const reports = allRooms.map((r) => {
    const scheduledSlots = roomUsage.get(r.id) ?? 0;
    const totalSlots = totalTimeslots;
    const utilizationRate = totalSlots > 0 ? Math.round((scheduledSlots / totalSlots) * 1000) / 10 : 0;
    let status: "underutilized" | "normal" | "highly_utilized" = "normal";
    if (utilizationRate < 30) status = "underutilized";
    if (utilizationRate >= 75) status = "highly_utilized";

    return {
      roomId: r.id,
      roomNumber: r.roomNumber,
      building: r.building,
      type: r.type,
      capacity: r.capacity,
      scheduledSlots,
      totalSlots,
      utilizationRate,
      status,
    };
  });

  res.json(reports);
});

export default router;
