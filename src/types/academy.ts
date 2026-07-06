export type AcademyQuestionOption = {
  id: string;
  label: string;
  isCorrect: boolean;
};

export type AcademyQuestion = {
  id: string;
  prompt: string;
  explanation: string;
  options: AcademyQuestionOption[];
};

export type AcademyChapter = {
  id: string;
  title: string;
  objective: string;
  estimatedMinutes: number;
  sections: Array<{
    title: string;
    body: string[];
  }>;
  checkpoint: AcademyQuestion;
  exam: AcademyQuestion[];
};

export type AcademyCourse = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  passingScore: number;
  estimatedMinutes: number;
  audience: string;
  chapters: AcademyChapter[];
};

export type AcademyProgressRow = {
  id: string;
  company_id: string;
  user_profile_id: string;
  course_slug: string;
  chapter_id: string;
  status: "not_started" | "in_progress" | "completed" | "approved";
  progress_percent: number;
  best_score: number | null;
  completed_at: string | null;
  last_activity_at: string | null;
};

export type AcademyAttemptRow = {
  id: string;
  company_id: string;
  user_profile_id: string;
  course_slug: string;
  chapter_id: string;
  score: number;
  passed: boolean;
  submitted_at: string;
};

export type AcademyChapterStatus = {
  chapter: AcademyChapter;
  progress: AcademyProgressRow | null;
  attempts: AcademyAttemptRow[];
  score: number | null;
  completed: boolean;
  approved: boolean;
};

export type AcademyReportRow = {
  userId: string;
  fullName: string;
  email: string | null;
  role: string | null;
  businessArea: string | null;
  progressPercent: number;
  completedChapters: number;
  approvedChapters: number;
  averageScore: number | null;
  lastActivityAt: string | null;
  status: "not_started" | "in_progress" | "approved";
};
