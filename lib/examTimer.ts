/**
 * Auto Exam Timer Logic: Time (minutes) = ceil(Q * 25 / 24)
 */
export function calculateExamMinutes(questionCount: number): number {
  return Math.ceil(questionCount * (25 / 24));
}

/**
 * Auto-Balanced Generator split: 30% Easy, 50% Medium, 20% Hard.
 */
export function balancedDifficultySplit(questionCount: number) {
  const easy = Math.round(questionCount * 0.3);
  const hard = Math.round(questionCount * 0.2);
  const medium = questionCount - easy - hard;
  return { easy, medium, hard };
}
