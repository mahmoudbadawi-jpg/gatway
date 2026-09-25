"use client";

import { useState } from "react";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase } from "@/lib/supabaseClient";
import { parseCSV, rowsToObjects } from "@/lib/csv";
import { Difficulty } from "@/lib/types";

const TEMPLATE_HEADERS = [
  "text_en",
  "text_ar",
  "option1_en",
  "option2_en",
  "option3_en",
  "option4_en",
  "option1_ar",
  "option2_ar",
  "option3_ar",
  "option4_ar",
  "correct_option_index",
  "explanation_en",
  "explanation_ar",
  "difficulty",
  "target_grade",
];

interface ParsedQuestion {
  text_en: string;
  text_ar: string;
  options_en: string[];
  options_ar: string[];
  correct_option_index: number;
  explanation_en: string;
  explanation_ar: string;
  difficulty: Difficulty;
  target_grade: number;
  rowNumber: number;
  errors: string[];
}

export default function BulkImportPage() {
  const { profile, loading } = useRequireRole(["ADMIN", "INSTRUCTOR"]);
  const [parsed, setParsed] = useState<ParsedQuestion[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function downloadTemplate() {
    const example = [
      "What is 2 + 2?",
      "كم يساوي 2 + 2؟",
      "3",
      "4",
      "5",
      "6",
      "٣",
      "٤",
      "٥",
      "٦",
      "1",
      "2 + 2 equals 4.",
      "2 + 2 يساوي 4.",
      "EASY",
      "4",
    ];
    const csv = [TEMPLATE_HEADERS.join(","), example.map((v) => `"${v}"`).join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gatway_question_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = parseCSV(text);
      const objects = rowsToObjects(rows);

      const questions: ParsedQuestion[] = objects.map((obj, idx) => {
        const errors: string[] = [];
        const correctIndex = Number(obj.correct_option_index);
        const grade = Number(obj.target_grade);
        const difficulty = obj.difficulty?.toUpperCase() as Difficulty;

        if (!obj.text_en) errors.push("missing text_en");
        if (!obj.text_ar) errors.push("missing text_ar");
        if (Number.isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3)
          errors.push("correct_option_index must be 0-3");
        if (!["EASY", "MEDIUM", "HARD"].includes(difficulty))
          errors.push("difficulty must be EASY/MEDIUM/HARD");
        if (Number.isNaN(grade) || grade < 4 || grade > 12)
          errors.push("target_grade must be 4-12");
        [obj.option1_en, obj.option2_en, obj.option3_en, obj.option4_en].forEach((o, i) => {
          if (!o) errors.push(`missing option${i + 1}_en`);
        });
        [obj.option1_ar, obj.option2_ar, obj.option3_ar, obj.option4_ar].forEach((o, i) => {
          if (!o) errors.push(`missing option${i + 1}_ar`);
        });

        return {
          text_en: obj.text_en,
          text_ar: obj.text_ar,
          options_en: [obj.option1_en, obj.option2_en, obj.option3_en, obj.option4_en],
          options_ar: [obj.option1_ar, obj.option2_ar, obj.option3_ar, obj.option4_ar],
          correct_option_index: correctIndex,
          explanation_en: obj.explanation_en ?? "",
          explanation_ar: obj.explanation_ar ?? "",
          difficulty,
          target_grade: grade,
          rowNumber: idx + 2, // +2: header row + 1-indexed
          errors,
        };
      });

      setParsed(questions);
    };
    reader.readAsText(file);
  }

  const validRows = parsed.filter((q) => q.errors.length === 0);
  const invalidRows = parsed.filter((q) => q.errors.length > 0);

  async function handleImport() {
    if (validRows.length === 0) return;
    setImporting(true);
    setResult(null);

    const payload = validRows.map((q) => ({
      author_id: profile!.id,
      text_en: q.text_en,
      text_ar: q.text_ar,
      options_en: q.options_en,
      options_ar: q.options_ar,
      correct_option_index: q.correct_option_index,
      explanation_en: q.explanation_en,
      explanation_ar: q.explanation_ar,
      difficulty: q.difficulty,
      target_grade: q.target_grade,
    }));

    const { error, data } = await supabase.from("questions").insert(payload).select();
    setImporting(false);
    if (error) {
      setResult(`Import failed: ${error.message}`);
      return;
    }
    setResult(`Imported ${data?.length ?? 0} questions successfully.`);
    setParsed([]);
    setFileName(null);
  }

  if (loading || !profile) return <p className="text-navy/60">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy">Bulk Importer</h1>

      <div className="card flex flex-wrap items-center gap-4 p-5">
        <button
          onClick={downloadTemplate}
          className="rounded-card border border-border px-4 py-2 text-sm text-navy hover:border-teal"
        >
          Download CSV template
        </button>
        <label className="rounded-card bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-light cursor-pointer">
          Choose CSV file
          <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
        </label>
        {fileName && <span className="text-sm text-navy/60">{fileName}</span>}
      </div>

      <p className="text-sm text-navy/60">
        Columns required: {TEMPLATE_HEADERS.join(", ")}. Download the template above for the
        exact format — options 1–4 in order, correct_option_index is 0-based (0 = option 1).
      </p>

      {parsed.length > 0 && (
        <div className="card flex flex-col gap-4 p-5">
          <p className="font-medium text-navy">
            {validRows.length} valid · {invalidRows.length} with errors · {parsed.length} total
          </p>

          {invalidRows.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {invalidRows.map((r) => (
                <p key={r.rowNumber}>
                  Row {r.rowNumber}: {r.errors.join(", ")}
                </p>
              ))}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-navy/60">
                  <th className="py-2 pr-3">Row</th>
                  <th className="py-2 pr-3">Question (EN)</th>
                  <th className="py-2 pr-3">Grade</th>
                  <th className="py-2 pr-3">Difficulty</th>
                </tr>
              </thead>
              <tbody>
                {validRows.map((q) => (
                  <tr key={q.rowNumber} className="border-b border-border/60">
                    <td className="py-2 pr-3">{q.rowNumber}</td>
                    <td className="py-2 pr-3">{q.text_en}</td>
                    <td className="py-2 pr-3">{q.target_grade}</td>
                    <td className="py-2 pr-3">{q.difficulty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            disabled={importing || validRows.length === 0}
            className="self-start rounded-card bg-teal px-5 py-2.5 font-medium text-white hover:bg-teal-light disabled:opacity-60"
          >
            {importing ? "Importing…" : `Import ${validRows.length} questions`}
          </button>
        </div>
      )}

      {result && <p className="text-navy">{result}</p>}
    </div>
  );
}
