import { Router } from "express";
import { db } from "@workspace/db";
import { sectionsTable, yearLevelsTable } from "@workspace/db";
import { eq, gt } from "drizzle-orm";
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
  const sections = await db.select().from(sectionsTable).orderBy(sectionsTable.yearLevelId, sectionsTable.name);
  res.json(sections.map(serializeSection));
});

router.put("/sections/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateSectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const [updated] = await db.update(sectionsTable).set(parsed.data).where(eq(sectionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeSection(updated));
});

router.post("/sections/overflow-suggestions", async (req, res) => {
  const allSections = await db.select().from(sectionsTable);
  const yearLevels = await db.select().from(yearLevelsTable);

  const yearLevelMap = new Map(yearLevels.map(yl => [yl.id, yl.name]));

  const overflowSections = allSections.filter(s => s.enrolledCount > s.capacity);

  if (overflowSections.length === 0) {
    res.json({
      overflowSections: [],
      suggestions: [],
      summary: "No sections are currently over capacity. All enrollments are within limits.",
      generatedAt: new Date().toISOString(),
    });
    return;
  }

  const sectionContext = allSections.map(s => ({
    id: s.id,
    name: s.name,
    yearLevel: yearLevelMap.get(s.yearLevelId) ?? "Unknown",
    yearLevelId: s.yearLevelId,
    capacity: s.capacity,
    enrolledCount: s.enrolledCount,
    availableSlots: s.capacity - s.enrolledCount,
    isOverflow: s.enrolledCount > s.capacity,
    overflowCount: Math.max(0, s.enrolledCount - s.capacity),
  }));

  const systemPrompt = `You are an academic enrollment management assistant for a school scheduling system.
Your task is to analyze section enrollment data and suggest specific student transfer plans to resolve overcrowding.

Rules for suggestions:
1. Students should be transferred to sections of the SAME year level whenever possible
2. Only suggest transfers to sections that have available capacity (availableSlots > 0)
3. Each suggestion should specify exactly how many students to transfer
4. Prioritize keeping students in the same year level (same yearLevelId)
5. If no same-year-level section has space, suggest the closest year level as a fallback
6. A section is "high priority" if it is more than 10 students over capacity
7. Be specific and practical — suggest concrete section-to-section transfers

Return ONLY valid JSON in this exact format:
{
  "suggestions": [
    {
      "fromSectionId": number,
      "fromSectionName": "string",
      "toSectionId": number,
      "toSectionName": "string",
      "studentsToTransfer": number,
      "reason": "concise explanation",
      "yearLevel": "year level name",
      "priority": "high" | "medium" | "low"
    }
  ],
  "summary": "2-3 sentence plain-language summary of the overall enrollment situation and recommended actions"
}`;

  const userMessage = `Here is the current enrollment data for all sections:

${JSON.stringify(sectionContext, null, 2)}

Overflow sections needing resolution:
${overflowSections.map(s => `- ${s.name} (${yearLevelMap.get(s.yearLevelId)}): ${s.enrolledCount}/${s.capacity} students (${s.enrolledCount - s.capacity} over limit)`).join("\n")}

Please generate transfer suggestions to bring all overflow sections within the 40-student capacity limit.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
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
