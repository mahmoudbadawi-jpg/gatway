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

function buildAIPrompt(topic: string, grade: number, count: number) {
  return `You are generating exam-prep questions for the GAT (Qudurat) test, grade ${grade} level, on the topic: ${topic || "general aptitude"}.

Generate exactly ${count} multiple-choice questions in bilingual English and Arabic, formatted as CSV with EXACTLY this header row (case-sensitive, comma-separated):
text_en,text_ar,option1_en,option2_en,option3_en,option4_en,option1_ar,option2_ar,option3_ar,option4_ar,correct_option_index,explanation_en,explanation_ar,difficulty,target_grade

Rules:
- Output ONLY the CSV content: the header row, then one row per question. No markdown code fences, no commentary before or after.
- Wrap every field in double quotes, since some fields contain commas.
- correct_option_index is 0-based: 0 = option1, 1 = option2, 2 = option3, 3 = option4.
- difficulty must be exactly EASY, MEDIUM, or HARD (uppercase, no other values).
- target_grade must be the number ${grade} for every row.
- Roughly 30% EASY, 50% MEDIUM, 20% HARD across the ${count} questions.
- Arabic text must be natural, correct Modern Standard Arabic — not a literal machine translation of the English.
- Each explanation should be 1–2 sentences explaining why the correct answer is right.
- Do not repeat the same question twice, and vary the phrasing/structure across questions.
- Keep questions realistic and appropriate to a grade ${grade} general aptitude test, focused on: ${topic || "a general mix of verbal and quantitative reasoning"}.

Begin your output now with the header row, then the ${count} question rows.`;
}

export default function BulkImportPage() {
  const { profile, loading } = useRequireRole(["ADMIN", "INSTRUCTOR"]);
  const [parsed, setParsed] = useState<ParsedQuestion[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [aiTopic, setAiTopic] = useState("");
  const [aiGrade, setAiGrade] = useState(7);
  const [aiCount, setAiCount] = useState(20);
  const [copied, setCopied] = useState(false);

  function copyPrompt() {
    navigator.clipboard.writeText(buildAIPrompt(aiTopic, aiGrade, aiCount));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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

      <div className="card flex flex-col gap-4 p-5">
        <div>
          <p className="font-medium text-navy">Generate questions with AI</p>
          <p className="text-sm text-navy/60">
            Fill in a topic, grade, and count, copy the prompt, and paste it into ChatGPT,
            Claude, Gemini, or any AI model. It outputs CSV text ready to save as a .csv file
            and upload above.
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-navy/80">Topic</span>
            <input
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="e.g. reading comprehension, algebra, analogies"
              className="w-64 rounded-lg border border-border px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-navy/80">Grade</span>
            <select
              value={aiGrade}
              onChange={(e) => setAiGrade(Number(e.target.value))}
              className="w-28 rounded-lg border border-border px-3 py-2"
            >
              {Array.from({ length: 9 }, (_, i) => i + 4).map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-navy/80"># of questions</span>
            <input
              type="number"
              min={1}
              max={100}
              value={aiCount}
              onChange={(e) => setAiCount(Number(e.target.value))}
              className="w-24 rounded-lg border border-border px-3 py-2"
            />
          </label>
        </div>

        <textarea
          readOnly
          value={buildAIPrompt(aiTopic, aiGrade, aiCount)}
          className="h-48 w-full resize-none rounded-lg border border-border bg-canvas-alt p-3 font-mono text-xs text-navy/80"
        />

        <button
          onClick={copyPrompt}
          className="self-start rounded-card bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-light"
        >
          {copied ? "Copied!" : "Copy prompt"}
        </button>

        <p className="text-xs text-navy/50">
          After the AI responds, copy its output, paste it into a plain text file, save it with
          a .csv extension, then upload it above using "Choose CSV file".
        </p>
      </div>

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
