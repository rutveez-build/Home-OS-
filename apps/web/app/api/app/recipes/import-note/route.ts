import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
// pdf-parse's index.js has a debug branch that misfires under bundlers —
// import the library entry point directly.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { extractRecipeFromTranscript } from "@/lib/recipes-import";
import { saveRecipe } from "@/lib/recipes";

export const runtime = "nodejs";
export const maxDuration = 60;

// Accept a pasted note (Google Keep / Notes share → copy → paste) or a PDF.
const Body = z
  .object({
    title: z.string().trim().max(120).optional(),
    text: z.string().trim().min(30, "That note is too short to be a recipe.").max(20000).optional(),
    // data:application/pdf;base64,... — stays inside Vercel's ~4.5MB body cap
    pdfDataUrl: z
      .string()
      .regex(/^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/, "Only PDF uploads are supported.")
      .max(5_500_000, "PDF is too large — keep it under ~4MB.")
      .optional(),
  })
  .refine((b) => b.text || b.pdfDataUrl, { message: "Paste a note or attach a PDF." });

// ponytail: same in-process per-family cooldown as the YouTube importer.
const lastImport = new Map<string, number>();
const IMPORT_COOLDOWN_MS = 15_000;

export async function POST(req: NextRequest) {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid import" },
      { status: 400 }
    );
  }

  const last = lastImport.get(auth.familyId) ?? 0;
  if (Date.now() - last < IMPORT_COOLDOWN_MS) {
    return NextResponse.json({ error: "One import at a time — try again in a few seconds." }, { status: 429 });
  }
  lastImport.set(auth.familyId, Date.now());

  let text = parsed.data.text ?? "";
  let sourceTag = "note";
  if (parsed.data.pdfDataUrl) {
    sourceTag = "pdf";
    try {
      const buf = Buffer.from(parsed.data.pdfDataUrl.split(",")[1], "base64");
      if (buf.byteLength > 4_500_000) {
        return NextResponse.json({ error: "PDF is too large — keep it under ~4MB." }, { status: 413 });
      }
      const pdf = await pdfParse(buf, { max: 20 }); // first 20 pages is plenty for a recipe
      text = pdf.text.trim();
    } catch {
      return NextResponse.json({ error: "Couldn't read that PDF." }, { status: 422 });
    }
    if (text.length < 30) {
      return NextResponse.json(
        { error: "That PDF has no readable text — scanned images aren't supported yet." },
        { status: 422 }
      );
    }
  }

  const extracted = await extractRecipeFromTranscript(
    parsed.data.title || "Shared recipe",
    text.slice(0, 16000),
    "note"
  );
  if ("error" in extracted) return NextResponse.json({ error: extracted.error }, { status: 422 });

  const result = await saveRecipe({
    familyId: auth.familyId,
    userId: auth.userId,
    title: extracted.title,
    description: extracted.description,
    servings: extracted.servings,
    ingredients: extracted.ingredients,
    steps: extracted.steps,
    tags: [...(extracted.tags ?? []), sourceTag].slice(0, 10),
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
