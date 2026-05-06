import { Router } from "express";
import { db } from "@workspace/db";
import {
  loiDocumentsTable,
  facultyTable,
  facultySpecializationsTable,
  facultyAvailabilityTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const ProcessLoiBody = z.object({
  facultyId: z.coerce.number().int().optional(),
  text: z.string().min(10),
  fileName: z.string().optional(),
});

const LOI_SYSTEM_PROMPT = `You are an academic records assistant. Extract structured information from a faculty Letter of Intent (LOI).

Return ONLY valid JSON in this exact format:
{
  "teacher_profile": {
    "full_name": "string or null",
    "email": "string or null",
    "department": "string or null",
    "employment_type": "full_time | part_time | null",
    "specializations": ["subject area 1", "subject area 2"],
    "preferred_subjects": ["subject 1", "subject 2"],
    "years_experience": number or null
  },
  "availability": {
    "Monday": ["Morning", "Afternoon", "Evening"],
    "Tuesday": ["Morning", "Afternoon", "Evening"],
    "Wednesday": ["Morning", "Afternoon", "Evening"],
    "Thursday": ["Morning", "Afternoon", "Evening"],
    "Friday": ["Morning", "Afternoon", "Evening"],
    "Saturday": ["Morning", "Afternoon", "Evening"]
  },
  "unavailable_days": ["day1", "day2"],
  "notes": "any additional context"
}

Only include days and time slots the teacher explicitly mentions as available. Leave availability empty object if not mentioned. Use null for fields not found in the text.`;

function serialize(doc: typeof loiDocumentsTable.$inferSelect) {
  return {
    ...doc,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

router.get("/loi", async (req, res) => {
  const docs = await db.select().from(loiDocumentsTable).orderBy(loiDocumentsTable.createdAt);
  res.json(docs.map(serialize));
});

router.get("/loi/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [doc] = await db.select().from(loiDocumentsTable).where(eq(loiDocumentsTable.id, id));
  if (!doc) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(doc));
});

router.post("/loi", async (req, res) => {
  const parsed = ProcessLoiBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: parsed.error.message });
    return;
  }
  const { facultyId, text, fileName } = parsed.data;

  const [doc] = await db
    .insert(loiDocumentsTable)
    .values({ facultyId, originalText: text, fileName, status: "processing" })
    .returning();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: LOI_SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";
    const extractedData = JSON.parse(rawContent);

    const [updated] = await db
      .update(loiDocumentsTable)
      .set({ status: "processed", extractedData })
      .where(eq(loiDocumentsTable.id, doc.id))
      .returning();

    res.json({
      loiId: doc.id,
      extractedData,
      autoApplied: false,
      message: "LOI processed successfully. Review the extracted data and click Apply to update the faculty profile.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(loiDocumentsTable)
      .set({ status: "failed", processingError: msg })
      .where(eq(loiDocumentsTable.id, doc.id));
    res.status(500).json({ error: "Processing failed", message: msg });
  }
});

router.post("/loi/:id/apply", async (req, res) => {
  const id = Number(req.params.id);
  const [doc] = await db.select().from(loiDocumentsTable).where(eq(loiDocumentsTable.id, id));
  if (!doc) { res.status(404).json({ error: "Not found" }); return; }
  if (doc.status !== "processed" || !doc.extractedData) {
    res.status(400).json({ error: "LOI not processed yet" });
    return;
  }

  const data = doc.extractedData as Record<string, unknown>;
  const profile = data["teacher_profile"] as Record<string, unknown> | undefined;
  const availability = data["availability"] as Record<string, string[]> | undefined;
  const results: string[] = [];

  if (doc.facultyId && profile) {
    const update: Record<string, unknown> = {};
    if (profile.department) update.department = profile.department;
    if (Object.keys(update).length > 0) {
      await db.update(facultyTable).set(update).where(eq(facultyTable.id, doc.facultyId));
      results.push("Updated faculty profile");
    }

    const specs = profile.specializations as string[] | undefined;
    if (specs?.length) {
      await db.delete(facultySpecializationsTable).where(eq(facultySpecializationsTable.facultyId, doc.facultyId));
      await db.insert(facultySpecializationsTable).values(
        specs.map((s, i) => ({
          facultyId: doc.facultyId!,
          subjectArea: s,
          isPrimary: i === 0,
          yearsExperience: typeof profile.years_experience === "number" ? profile.years_experience : null,
        }))
      );
      results.push(`Added ${specs.length} specialization(s)`);
    }

    if (availability) {
      await db.delete(facultyAvailabilityTable).where(eq(facultyAvailabilityTable.facultyId, doc.facultyId));
      const rows: typeof facultyAvailabilityTable.$inferInsert[] = [];
      for (const [day, times] of Object.entries(availability)) {
        for (const timeOfDay of times) {
          rows.push({
            facultyId: doc.facultyId,
            day,
            timeOfDay,
            isAvailable: true,
            employmentType: (profile.employment_type as string) ?? "full_time",
          });
        }
      }
      if (rows.length) {
        await db.insert(facultyAvailabilityTable).values(rows);
        results.push(`Set ${rows.length} availability slot(s)`);
      }
    }
  }

  res.json({ success: true, applied: results, message: results.join(", ") || "Nothing to apply" });
});

router.delete("/loi/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.delete(loiDocumentsTable).where(eq(loiDocumentsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

export default router;
