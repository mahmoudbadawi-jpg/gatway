export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface Category {
  id: string;
  name_en: string;
  name_ar: string;
  description: string | null;
}

export interface Question {
  id: string;
  author_id: string | null;
  text_en: string;
  text_ar: string;
  options_en: string[];
  options_ar: string[];
  correct_option_index: number;
  explanation_en: string;
  explanation_ar: string;
  difficulty: Difficulty;
  target_grade: number;
  created_at: string;
}

export interface Exam {
  id: string;
  creator_id: string;
  title_en: string;
  title_ar: string;
  is_public: boolean;
  question_count: number;
  calculated_time_minutes: number;
  share_token: string;
  created_at: string;
}

export interface ExamQuestionRow {
  exam_id: string;
  question_id: string;
  sequence: number;
}

export interface StudentAttempt {
  id: string;
  student_id: string;
  exam_id: string;
  score: number | null;
  answers: Record<string, number>; // question_id -> chosen option index
  flagged: string[]; // question_ids
  status: "IN_PROGRESS" | "SUBMITTED" | "TIMED_OUT";
  started_at: string;
  submitted_at: string | null;
}
