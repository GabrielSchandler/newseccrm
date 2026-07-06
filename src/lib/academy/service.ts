import type { SupabaseClient } from "@supabase/supabase-js";
import { academyCourse } from "@/lib/academy/course";
import type {
  AcademyAttemptRow,
  AcademyChapterStatus,
  AcademyCourse,
  AcademyProgressRow,
  AcademyReportRow,
} from "@/types/academy";

export function isAcademyMissingTableError(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const normalized = message.toLowerCase();

  return (
    normalized.includes("schema cache") ||
    normalized.includes("does not exist") ||
    normalized.includes("could not find")
  );
}

function average(values: number[]) {
  if (!values.length) {
    return null;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function latestDate(values: Array<string | null | undefined>) {
  const dates = values.filter((value): value is string => Boolean(value));

  if (!dates.length) {
    return null;
  }

  return dates.sort((a, b) => b.localeCompare(a))[0];
}

export function buildAcademyChapterStatuses({
  course = academyCourse,
  progressRows,
  attemptRows,
}: {
  course?: AcademyCourse;
  progressRows: AcademyProgressRow[];
  attemptRows: AcademyAttemptRow[];
}): AcademyChapterStatus[] {
  return course.chapters.map((chapter) => {
    const progress =
      progressRows.find((row) => row.chapter_id === chapter.id) ?? null;
    const attempts = attemptRows.filter((row) => row.chapter_id === chapter.id);
    const score =
      progress?.best_score ??
      (attempts.length ? Math.max(...attempts.map((attempt) => attempt.score)) : null);
    const approved = Boolean(progress?.status === "approved" || attempts.some((attempt) => attempt.passed));
    const completed = Boolean(
      approved || progress?.status === "completed" || progress?.completed_at,
    );

    return {
      chapter,
      progress,
      attempts,
      score,
      completed,
      approved,
    };
  });
}

export function summarizeAcademyProgress(statuses: AcademyChapterStatus[]) {
  const completedChapters = statuses.filter((status) => status.completed).length;
  const approvedChapters = statuses.filter((status) => status.approved).length;
  const scores = statuses
    .map((status) => status.score)
    .filter((score): score is number => typeof score === "number");
  const progressPercent = Math.round(
    (completedChapters / Math.max(statuses.length, 1)) * 100,
  );

  return {
    progressPercent,
    completedChapters,
    approvedChapters,
    averageScore: average(scores),
    status:
      approvedChapters === statuses.length && statuses.length > 0
        ? "approved"
        : completedChapters > 0
          ? "in_progress"
          : "not_started",
  } as const;
}

export async function loadAcademyUserProgress({
  supabase,
  companyId,
  userProfileId,
  course = academyCourse,
}: {
  supabase: SupabaseClient;
  companyId: string;
  userProfileId: string;
  course?: AcademyCourse;
}) {
  const [progressResult, attemptsResult] = await Promise.all([
    supabase
      .from("academy_chapter_progress")
      .select("*")
      .eq("company_id", companyId)
      .eq("user_profile_id", userProfileId)
      .eq("course_slug", course.slug),
    supabase
      .from("academy_exam_attempts")
      .select("*")
      .eq("company_id", companyId)
      .eq("user_profile_id", userProfileId)
      .eq("course_slug", course.slug)
      .order("submitted_at", { ascending: false }),
  ]);

  if (progressResult.error || attemptsResult.error) {
    const error = progressResult.error ?? attemptsResult.error;

    if (isAcademyMissingTableError(error)) {
      return {
        tableReady: false,
        errorMessage: null,
        statuses: buildAcademyChapterStatuses({
          course,
          progressRows: [],
          attemptRows: [],
        }),
      };
    }

    return {
      tableReady: true,
      errorMessage: error?.message ?? "Nao foi possivel carregar o Academy.",
      statuses: buildAcademyChapterStatuses({
        course,
        progressRows: [],
        attemptRows: [],
      }),
    };
  }

  return {
    tableReady: true,
    errorMessage: null,
    statuses: buildAcademyChapterStatuses({
      course,
      progressRows: (progressResult.data ?? []) as AcademyProgressRow[],
      attemptRows: (attemptsResult.data ?? []) as AcademyAttemptRow[],
    }),
  };
}

export async function loadAcademyReport({
  supabase,
  companyId,
  course = academyCourse,
}: {
  supabase: SupabaseClient;
  companyId: string;
  course?: AcademyCourse;
}) {
  const usersResult = await supabase
    .from("user_profiles")
    .select("id, full_name, nickname, email, role, business_area, is_active")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (usersResult.error) {
    return {
      tableReady: true,
      errorMessage: usersResult.error.message,
      rows: [] as AcademyReportRow[],
    };
  }

  const userIds = (usersResult.data ?? []).map((user) => user.id);

  if (!userIds.length) {
    return { tableReady: true, errorMessage: null, rows: [] as AcademyReportRow[] };
  }

  const [progressResult, attemptsResult] = await Promise.all([
    supabase
      .from("academy_chapter_progress")
      .select("*")
      .eq("company_id", companyId)
      .eq("course_slug", course.slug)
      .in("user_profile_id", userIds),
    supabase
      .from("academy_exam_attempts")
      .select("*")
      .eq("company_id", companyId)
      .eq("course_slug", course.slug)
      .in("user_profile_id", userIds),
  ]);

  if (progressResult.error || attemptsResult.error) {
    const error = progressResult.error ?? attemptsResult.error;

    if (isAcademyMissingTableError(error)) {
      return { tableReady: false, errorMessage: null, rows: [] as AcademyReportRow[] };
    }

    return {
      tableReady: true,
      errorMessage: error?.message ?? "Nao foi possivel carregar o relatorio.",
      rows: [] as AcademyReportRow[],
    };
  }

  const progressRows = (progressResult.data ?? []) as AcademyProgressRow[];
  const attemptRows = (attemptsResult.data ?? []) as AcademyAttemptRow[];
  const rows: AcademyReportRow[] = (usersResult.data ?? []).map((user) => {
    const statuses = buildAcademyChapterStatuses({
      course,
      progressRows: progressRows.filter((row) => row.user_profile_id === user.id),
      attemptRows: attemptRows.filter((row) => row.user_profile_id === user.id),
    });
    const summary = summarizeAcademyProgress(statuses);
    const userProgressRows = progressRows.filter(
      (row) => row.user_profile_id === user.id,
    );
    const userAttemptRows = attemptRows.filter(
      (row) => row.user_profile_id === user.id,
    );

    return {
      userId: user.id,
      fullName: user.nickname || user.full_name || "Usuario sem nome",
      email: user.email ?? null,
      role: user.role ?? null,
      businessArea: user.business_area ?? null,
      progressPercent: summary.progressPercent,
      completedChapters: summary.completedChapters,
      approvedChapters: summary.approvedChapters,
      averageScore: summary.averageScore,
      lastActivityAt: latestDate([
        ...userProgressRows.map((row) => row.last_activity_at ?? row.completed_at),
        ...userAttemptRows.map((row) => row.submitted_at),
      ]),
      status: summary.status,
    };
  });

  return {
    tableReady: true,
    errorMessage: null,
    rows,
  };
}
