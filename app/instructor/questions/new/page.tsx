"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase } from "@/lib/supabaseClient";
import { Category, Difficulty } from "@/lib/types";

const EMPTY_OPTIONS = ["", "", "", ""];

export default function NewQuestionPage() {
  const { profile, loading } = useRequireRole(["ADMIN", "INSTRUCTOR"]);
  const router = useRouter();

  const [textEn, setTextEn] = useState("");
  const [textAr, setTextAr] = useState("");
  const [optionsEn, setOptionsEn] = useState<string[]>(EMPTY_OPTIONS);
  const [optionsAr, setOptionsAr] = useState<string[]>(EMPTY_OPTIONS);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanationEn, setExplanationEn] = useState("");
  const [explanationAr, setExplanationAr] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [grade, setGrade] = useState(4);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [newCategoryEn, setNewCategoryEn] = useState("");
  const [newCategoryAr, setNewCategoryAr] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadCategories();
  }, []);

  async function loadCategories() {
    const { data } = await supabase.from("categories").select("*").order("name_en");
    setCategories((data as Category[]) ?? []);
  }

  async function handleAddCategory() {
    if (!newCategoryEn.trim() || !newCategoryAr.trim()) return;
    const { data, error: err } = await supabase
      .from("categories")
      .insert({ name_en: newCategoryEn.trim(), name_ar: newCategoryAr.trim() })
      .select()
      .single();
    if (err) {
      alert(err.message);
      return;
    }
    setCategories((prev) => [...prev, data as Category]);
    setSelectedCategoryIds((prev) => [...prev, (data as Category).id]);
    setNewCategoryEn("");
    setNewCategoryAr("");
  }

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function updateOption(list: "en" | "ar", index: number, value: string) {
    const setter = list === "en" ? setOptionsEn : setOptionsAr;
    setter((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!textEn.trim() || !textAr.trim()) {
      setError("Question text is required in both languages.");
      return;
    }
    if (optionsEn.some((o) => !o.trim()) || optionsAr.some((o) => !o.trim())) {
      setError("All four options must be filled in, in both languages.");
      return;
    }
    if (!explanationEn.trim() || !explanationAr.trim()) {
      setError("Explanation is required in both languages.");
      return;
    }

    setSaving(true);
    const { data, error: err } = await supabase
      .from("questions")
      .insert({
        author_id: profile!.id,
        text_en: textEn.trim(),
        text_ar: textAr.trim(),
        options_en: optionsEn.map((o) => o.trim()),
        options_ar: optionsAr.map((o) => o.trim()),
        correct_option_index: correctIndex,
        explanation_en: explanationEn.trim(),
        explanation_ar: explanationAr.trim(),
        difficulty,
        target_grade: grade,
      })
      .select()
      .single();

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    if (selectedCategoryIds.length > 0) {
      await supabase.from("question_categories").insert(
        selectedCategoryIds.map((category_id) => ({
          question_id: (data as { id: string }).id,
          category_id,
        }))
      );
    }

    router.push("/instructor/questions");
  }

  if (loading || !profile) return <p className="text-navy/60">Loading…</p>;

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy">New Question</h1>

      <div className="card grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Question text (English)">
          <textarea
            value={textEn}
            onChange={(e) => setTextEn(e.target.value)}
            className="input min-h-[80px]"
          />
        </Field>
        <Field label="Question text (Arabic)">
          <textarea
            value={textAr}
            onChange={(e) => setTextAr(e.target.value)}
            dir="rtl"
            className="input min-h-[80px]"
          />
        </Field>
      </div>

      <div className="card flex flex-col gap-3 p-5">
        <p className="font-medium text-navy">Options — select the correct one</p>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="grid grid-cols-[auto_1fr_1fr] items-center gap-3">
            <input
              type="radio"
              name="correct"
              checked={correctIndex === i}
              onChange={() => setCorrectIndex(i)}
              className="h-4 w-4 accent-teal"
            />
            <input
              value={optionsEn[i]}
              onChange={(e) => updateOption("en", i, e.target.value)}
              placeholder={`Option ${i + 1} (English)`}
              className="input"
            />
            <input
              value={optionsAr[i]}
              onChange={(e) => updateOption("ar", i, e.target.value)}
              placeholder={`الخيار ${i + 1} (Arabic)`}
              dir="rtl"
              className="input"
            />
          </div>
        ))}
      </div>

      <div className="card grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Explanation (English)">
          <textarea
            value={explanationEn}
            onChange={(e) => setExplanationEn(e.target.value)}
            className="input min-h-[70px]"
          />
        </Field>
        <Field label="Explanation (Arabic)">
          <textarea
            value={explanationAr}
            onChange={(e) => setExplanationAr(e.target.value)}
            dir="rtl"
            className="input min-h-[70px]"
          />
        </Field>
      </div>

      <div className="card flex flex-wrap gap-6 p-5">
        <Field label="Difficulty">
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            className="input w-40"
          >
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </Field>
        <Field label="Target grade">
          <select
            value={grade}
            onChange={(e) => setGrade(Number(e.target.value))}
            className="input w-32"
          >
            {Array.from({ length: 9 }, (_, i) => i + 4).map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="card flex flex-col gap-3 p-5">
        <p className="font-medium text-navy">Categories (optional)</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span
              key={c.id}
              className="pill-card"
              data-selected={selectedCategoryIds.includes(c.id)}
              onClick={() => toggleCategory(c.id)}
            >
              {c.name_en}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <input
            value={newCategoryEn}
            onChange={(e) => setNewCategoryEn(e.target.value)}
            placeholder="New category (English)"
            className="input w-56"
          />
          <input
            value={newCategoryAr}
            onChange={(e) => setNewCategoryAr(e.target.value)}
            placeholder="فئة جديدة (Arabic)"
            dir="rtl"
            className="input w-56"
          />
          <button
            type="button"
            onClick={handleAddCategory}
            className="rounded-card border border-border px-3 py-2 text-sm text-navy hover:border-teal"
          >
            Add category
          </button>
        </div>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-card bg-navy px-5 py-2.5 font-medium text-white hover:bg-navy-light disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save Question"}
      </button>

      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: white;
        }
        .input:focus {
          outline: 2px solid #00a88f;
          outline-offset: 1px;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-navy/80">{label}</span>
      {children}
    </label>
  );
}
