import { Router } from "express";
import { db } from "@workspace/db";
import {
  sectionsTable,
  yearLevelsTable,
  coursesTable,
  schedulesTable,
  facultyTable,
  facultySpecializationsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const UpdateSectionBody = z.object({
  name: z.string().optional(),
  capacity: z.coerce.number().int().min(1).optional(),
  enrolledCount: z.coerce.number().int().min(0).optional(),
  adviserId: z.coerce.number().int().optional().nullable(),
});

function serializeSection(s: typeof sectionsTable.$inferSelect) {
  return {
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/sections", async (req, res) => {
  const sections = await db
    .select()
    .from(sectionsTable)
    .orderBy(sectionsTable.yearLevelId, sectionsTable.name);
  res.json(sections.map(serializeSection));
});

router.put("/sections/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateSectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(sectionsTable)
    .set(parsed.data)
    .where(eq(sectionsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeSection(updated));
});

router.post("/sections/overflow-suggestions", async (req, res) => {
  const [allSections, yearLevels, allCourses, allSchedules, allSpecializations] =
    await Promise.all([
      db.select().from(sectionsTable),
      db.select().from(yearLevelsTable),
      db.select().from(coursesTable),
      db.select().from(schedulesTable),
      db.select().from(facultySpecializationsTable),
    ]);

  const yearLevelMap = new Map(yearLevels.map((yl) => [yl.id, yl.name]));
  const overflowSections = allSections.filter((s) => s.enrolledCount > s.capacity);

  if (overflowSections.length === 0) {
    res.json({
      overflowSections: [],
      suggestions: [],
      summary: "No sections are currently over capacity. All enrollments are within the 40-student limit.",
      generatedAt: new Date().toISOString(),
    });
    return;
  }

  // Build per-section subject map: match courses.section (text) to section name
  const subjectsBySectionName = new Map<string, Array<{ code: string; name: string; department: string }>>(); 
  for (const course of allCourses) {
    const sectionName = course.section; // e.g. "1A", "2B"
    if (!subjectsBySectionName.has(sectionName)) {
      subjectsBySectionName.set(sectionName, []);
    }
    subjectsBySectionName.get(sectionName)!.push({
      code: course.code,
      name: course.name,
      department: course.department,
    });
  }

  // Build per-section specialization map through schedules → faculty → specializations
  // schedules link courseId → facultyId; courses link to sections by name
  const facultySpecsByFacultyId = new Map<number, string[]>();
  for (const spec of allSpecializations) {
    if (!facultySpecsByFacultyId.has(spec.facultyId)) {
      facultySpecsByFacultyId.set(spec.facultyId, []);
    }
    facultySpecsByFacultyId.get(spec.facultyId)!.push(
      `${spec.subjectArea}${spec.isPrimary ? " (primary)" : ""}`
    );
  }

  // Map courseId → course for schedule lookups
  const courseById = new Map(allCourses.map((c) => [c.id, c]));

  // Build per-section specializations: which faculty/spec areas teach in this section
  const specializationsBySectionName = new Map<string, Set<string>>();
  for (const schedule of allSchedules) {
    const course = courseById.get(schedule.courseId);
    if (!course) continue;
    const sectionName = course.section;
    if (!specializationsBySectionName.has(sectionName)) {
      specializationsBySectionName.set(sectionName, new Set());
    }
    const specs = facultySpecsByFacultyId.get(schedule.facultyId) ?? [];
    for (const spec of specs) {
      specializationsBySectionName.get(sectionName)!.add(spec);
    }
  }

  // Assemble full context per section
  const sectionContext = allSections.map((s) => {
    const subjects = subjectsBySectionName.get(s.name) ?? [];
    const specs = [...(specializationsBySectionName.get(s.name) ?? [])];
    return {
      id: s.id,
      name: s.name,
      yearLevel: yearLevelMap.get(s.yearLevelId) ?? "Unknown",
      yearLevelId: s.yearLevelId,
      capacity: 40, // enforced school capacity
      enrolledCount: s.enrolledCount,
      availableSlots: 40 - s.enrolledCount,
      isOverflow: s.enrolledCount > 40,
      overflowCount: Math.max(0, s.enrolledCount - 40),
      subjects: subjects.map((c) => `${c.code} – ${c.name} (${c.department})`),
      specializations: specs,
    };
  });

  const systemPrompt = `You are an expert academic registrar for a Philippine higher-education institution.
Your task is to resolve section overcrowding by recommending SPECIFIC student transfers.
The maximum classroom capacity is strictly 40 students per section.

Rules you must follow:
1. Never recommend a transfer TO a section that would push it over 40 students.
   After the transfer, the target section enrolled count must be ≤ 40.
2. Prefer same year level (yearLevelId) transfers — keep students with peers at the same level.
3. When choosing the target section, match the SUBJECTS and SPECIALIZATIONS taught in both sections.
   Students should transfer to a section where the same subjects (or subjects from the same department) are offered.
4. If multiple target sections are available, pick the one with the best subject/specialization overlap.
5. A suggestion is "high" priority if a section is more than 10 students over capacity.
6. Include the exact list of matching subjects between source and target in your response.
7. Be concrete and actionable — specify exact section names and student counts.

Return ONLY valid JSON in this exact format (no extra keys):
{
  "suggestions": [
    {
      "fromSectionId": number,
      "fromSectionName": "string",
      "toSectionId": number,
      "toSectionName": "string",
      "studentsToTransfer": number,
      "yearLevel": "string",
      "priority": "high" | "medium" | "low",
      "matchedSubjects": ["list of subject codes/names that both sections share or are from the same dept"],
      "specializations": ["list of faculty specialization areas relevant to this transfer"],
      "subjectAlignment": "1-2 sentence explanation of why the subjects match and students will not miss any coursework",
      "reason": "concise overall rationale for this specific transfer",
      "toSectionAvailableSlots": number (slots remaining in target section AFTER the transfer)
    }
  ],
  "summary": "2-3 sentence plain-language overview of the enrollment situation and the recommended actions"
}`;

  const userMessage = `CURRENT SECTION DATA (capacity is hard-capped at 40):

${JSON.stringify(sectionContext, null, 2)}

OVERFLOW SECTIONS that must be resolved:
${overflowSections
  .map(
    (s) =>
      `- ${s.name} (${yearLevelMap.get(s.yearLevelId)}): ${s.enrolledCount}/40 enrolled, ${s.enrolledCount - 40} students must be transferred`
  )
  .join("\n")}

Generate transfer suggestions so every section ends up with ≤ 40 enrolled students.
Prioritize subject and specialization alignment when choosing target sections.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.15,
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";
    const aiResult = JSON.parse(rawContent) as {
      suggestions: Array<{
        fromSectionId: number;
        fromSectionName: string;
        toSectionId: number;
        toSectionName: string;
        studentsToTransfer: number;
        reason: string;
        yearLevel: string;
        priority: "high" | "medium" | "low";
        matchedSubjects: string[];
        specializations: string[];
        subjectAlignment: string;
        toSectionAvailableSlots: number;
      }>;
      summary: string;
    };

    res.json({
      overflowSections: overflowSections.map(serializeSection),
      suggestions: aiResult.suggestions ?? [],
      summary: aiResult.summary ?? "AI analysis complete.",
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "AI analysis failed", message: msg });
  }
});

export default router;
