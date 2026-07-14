"use client";

// Recipe guide — per the "Recipe Guide" mock: searchable recipe cards that
// expand into ingredients + numbered steps, plus a save/update form. Backed
// by /api/app/recipes (shared with find_recipes / save_recipe MCP tools).

import { useEffect, useRef, useState } from "react";
import { Card, CardBanner, Chip, EmptyState, Icon, PrimaryButton, SectionLabel, Spinner } from "./kit";

type Recipe = {
  id: string;
  title: string;
  description: string | null;
  servings: string | null;
  ingredients: { name: string; qty?: string }[];
  steps: string[];
  tags: string[];
  updatedAt: string;
};

const inputCls =
  "rounded-xl border border-stream-line bg-stream-bg px-3 py-2 text-[14px] text-stream-ink outline-none placeholder:text-stream-mute focus:border-stream-primary";

export function RecipesScreen({
  initialQuery,
  initialAdding,
  flash,
  onBack,
}: {
  initialQuery?: string;
  initialAdding?: boolean;
  flash: (m: string) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(initialAdding ?? false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(initialQuery ?? "");
  const [servings, setServings] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [ytUrl, setYtUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [importingNote, setImportingNote] = useState(false);

  async function load(q?: string) {
    const url = q?.trim() ? `/api/app/recipes?q=${encodeURIComponent(q.trim())}` : "/api/app/recipes";
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    setRecipes(data.recipes ?? []);
  }
  useEffect(() => {
    load(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!title.trim()) return flash("Give the recipe a title.");
    const ingredients = ingredientsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        // "Toor dal — 1 cup" / "Toor dal - 1 cup" / plain "Toor dal"
        const m = l.match(/^(.+?)\s*[—–-]\s*(.+)$/);
        return m ? { name: m[1].trim(), qty: m[2].trim() } : { name: l };
      });
    const steps = stepsText
      .split("\n")
      .map((l) => l.replace(/^\d+[.)]\s*/, "").trim())
      .filter(Boolean);
    setSaving(true);
    const res = await fetch("/api/app/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        servings: servings.trim() || undefined,
        ingredients: ingredients.length ? ingredients : undefined,
        steps: steps.length ? steps : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return flash(data.error ?? "Couldn't save that recipe.");
    flash(data.created ? "Recipe saved ✓" : "Recipe updated ✓");
    setAdding(false);
    setTitle("");
    setServings("");
    setIngredientsText("");
    setStepsText("");
    load(query);
  }

  const pdfInputRef = useRef<HTMLInputElement>(null);

  async function importNotePayload(body: Record<string, string>, kind: string) {
    setImportingNote(true);
    const res = await fetch("/api/app/recipes/import-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setImportingNote(false);
    if (!res.ok) return flash(data.error ?? `Couldn't import that ${kind}.`);
    flash(`Imported "${data.recipe.title}" ✓`);
    setNoteText("");
    load(query);
  }

  function importNote() {
    if (noteText.trim().length < 30) return flash("Paste the full recipe note first.");
    importNotePayload({ text: noteText.trim() }, "note");
  }

  function onPdfPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return flash("PDF is too large — keep it under 4MB.");
    const reader = new FileReader();
    reader.onload = () =>
      importNotePayload({ pdfDataUrl: String(reader.result), title: file.name.replace(/\.pdf$/i, "") }, "PDF");
    reader.onerror = () => flash("Couldn't read that file.");
    reader.readAsDataURL(file);
  }

  async function generateWithAI(dish: string) {
    if (!dish.trim()) return flash("Name the dish first.");
    setGenerating(true);
    const res = await fetch("/api/app/recipes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dish: dish.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setGenerating(false);
    if (!res.ok) return flash(data.error ?? "Couldn't generate that recipe.");
    flash(`Generated "${data.recipe.title}" ✓ — review it before the cook uses it.`);
    load(dish);
  }

  async function importFromYouTube() {
    if (!ytUrl.trim()) return flash("Paste a YouTube link first.");
    setImporting(true);
    const res = await fetch("/api/app/recipes/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: ytUrl.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setImporting(false);
    if (!res.ok) return flash(data.error ?? "Couldn't import that video.");
    flash(`Imported "${data.recipe.title}" from YouTube ✓`);
    setYtUrl("");
    load(query);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
      <section className="art-cooking relative -mx-4 -mt-5 flex h-40 flex-col justify-end px-5 pb-4">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="relative text-white">
          <h2 className="text-2xl font-semibold drop-shadow">Recipe guide</h2>
          <p className="text-sm text-white/85 drop-shadow">
            The household&apos;s own how-tos — searchable by dish, usable by anyone who cooks.
          </p>
        </div>
      </section>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(query)}
          placeholder="Search recipes (e.g. dal)"
          className={`${inputCls} min-w-0 flex-1`}
        />
        <button
          onClick={() => load(query)}
          className="shrink-0 rounded-xl border border-stream-primary/20 bg-stream-primary/5 px-3 text-[13px] font-semibold text-stream-primary"
        >
          Find
        </button>
        <button
          onClick={() => setAdding((v) => !v)}
          aria-label="Add recipe"
          className="shrink-0 rounded-xl bg-stream-primary px-3 text-stream-on-primary"
        >
          <Icon name={adding ? "close" : "add"} className="text-[18px]" />
        </button>
      </div>

      <Card className="overflow-hidden">
        <CardBanner icon="download" label="Import a recipe" />
        <div className="flex flex-col gap-2 p-4">
          <div className="flex gap-2">
            <input
              value={ytUrl}
              onChange={(e) => setYtUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && importFromYouTube()}
              placeholder="Paste a YouTube video link"
              className={`${inputCls} min-w-0 flex-1`}
            />
            <button
              onClick={importFromYouTube}
              disabled={importing}
              className="shrink-0 rounded-xl bg-stream-primary px-4 text-[13px] font-bold uppercase tracking-wide text-stream-on-primary disabled:opacity-50"
            >
              {importing ? "Importing…" : "Import"}
            </button>
          </div>
          <p className="text-[11.5px] text-stream-mute">
            YouTube: I read the video&apos;s captions and turn them into a saved recipe.
          </p>

          <div className="my-1 flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-stream-mute">
            <span className="h-px flex-1 bg-stream-line" /> or <span className="h-px flex-1 bg-stream-line" />
          </div>

          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={"Paste a recipe note — from Google Keep, Notes, WhatsApp, anywhere.\nShare → copy → paste here."}
            rows={3}
            className={`${inputCls} resize-y`}
          />
          <div className="flex gap-2">
            <button
              onClick={importNote}
              disabled={importingNote}
              className="flex-1 rounded-xl bg-stream-primary py-2.5 text-[13px] font-bold uppercase tracking-wide text-stream-on-primary disabled:opacity-50"
            >
              {importingNote ? "Importing…" : "Import note"}
            </button>
            <button
              onClick={() => pdfInputRef.current?.click()}
              disabled={importingNote}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-stream-primary/20 bg-stream-primary/5 py-2.5 text-[13px] font-bold uppercase tracking-wide text-stream-primary disabled:opacity-50"
            >
              <Icon name="picture_as_pdf" className="text-[16px]" /> Upload PDF
            </button>
          </div>
          <input ref={pdfInputRef} type="file" accept="application/pdf" onChange={onPdfPicked} className="hidden" />
        </div>
      </Card>

      {adding && (
        <Card className="overflow-hidden">
          <CardBanner icon="menu_book" label="Save a recipe" />
          <div className="flex flex-col gap-2 p-4">
            <div className="flex gap-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dish title" className={`${inputCls} min-w-0 flex-[2]`} />
              <input value={servings} onChange={(e) => setServings(e.target.value)} placeholder="Serves" className={`${inputCls} min-w-0 flex-1`} />
            </div>
            <textarea
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              placeholder={"Ingredients, one per line:\nToor dal — 1 cup\nOnion — 1, chopped"}
              rows={4}
              className={`${inputCls} resize-y`}
            />
            <textarea
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              placeholder={"Steps, one per line:\nRinse and soak the dal\nPressure cook 3 whistles"}
              rows={4}
              className={`${inputCls} resize-y`}
            />
            <PrimaryButton icon="save" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save recipe"}
            </PrimaryButton>
            <p className="text-[11.5px] text-stream-mute">
              Same title updates the existing recipe. Prefer not to type? The <strong>Import a
              recipe</strong> card above takes a YouTube link, a pasted note, or a PDF — or use
              Generate with AI from search.
            </p>
          </div>
        </Card>
      )}

      {recipes === null ? (
        <Spinner label="Loading recipes…" />
      ) : recipes.length === 0 ? (
        <div className="flex flex-col items-center gap-3">
          <EmptyState
            icon="menu_book"
            title={query ? `No recipes for "${query}"` : "No recipes yet"}
            body={
              query
                ? "The AI can write a home-style recipe for it — respecting your household's diets and allergies."
                : "Save one above, or ask the assistant to save a recipe for any dish on the plan."
            }
          />
          {query && (
            <PrimaryButton icon="auto_awesome" onClick={() => generateWithAI(query)} disabled={generating}>
              {generating ? "Writing the recipe…" : `Generate "${query}" with AI`}
            </PrimaryButton>
          )}
        </div>
      ) : (
        <>
          <SectionLabel>
            {recipes.length} recipe{recipes.length === 1 ? "" : "s"}
          </SectionLabel>
          <div className="flex flex-col gap-2">
            {recipes.map((r) => {
              const isOpen = open === r.id;
              return (
                <Card key={r.id} className="overflow-hidden">
                  <button
                    onClick={() => setOpen(isOpen ? null : r.id)}
                    className="flex w-full items-center gap-3 p-4 text-left"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stream-primary/10 text-stream-primary">
                      <Icon name="restaurant" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{r.title}</p>
                      <p className="text-[12.5px] text-stream-mute">
                        {r.servings ? `Serves ${r.servings} · ` : ""}
                        {r.ingredients.length} ingredients · {r.steps.length} steps
                      </p>
                    </div>
                    <Icon name={isOpen ? "expand_less" : "expand_more"} className="text-stream-mute" />
                  </button>
                  {isOpen && (
                    <div className="border-t border-stream-line p-4">
                      {r.description && <p className="mb-3 text-[13.5px] text-stream-mute">{r.description}</p>}
                      {r.tags.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {r.tags.map((t) => (
                            <Chip key={t}>{t}</Chip>
                          ))}
                        </div>
                      )}
                      {r.ingredients.length > 0 && (
                        <>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-stream-mute">Ingredients</p>
                          <ul className="mb-3 mt-1.5 space-y-1">
                            {r.ingredients.map((i, idx) => (
                              <li key={idx} className="flex justify-between gap-3 text-[14px]">
                                <span>{i.name}</span>
                                {i.qty && <span className="shrink-0 text-stream-mute">{i.qty}</span>}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      {r.steps.length > 0 && (
                        <>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-stream-mute">Steps</p>
                          <ol className="mt-1.5 space-y-2">
                            {r.steps.map((step, idx) => (
                              <li key={idx} className="flex gap-3 text-[14px] leading-relaxed">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stream-primary/10 text-[12px] font-bold text-stream-primary">
                                  {idx + 1}
                                </span>
                                {step}
                              </li>
                            ))}
                          </ol>
                        </>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      <button onClick={onBack} className="rounded-xl py-2 text-[13px] font-medium text-stream-mute">
        ← Back
      </button>
    </div>
  );
}
