"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getAcademyChapter,
  getAcademyCourse,
  getAcademyQuestionAnswer,
} from "@/lib/academy/course";
import { isAcademyMissingTableError } from "@/lib/academy/service";
import { getCurrentUserContext } from "@/lib/auth/current-user";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectWithAcademyError(courseSlug: string, chapterId: string, error: string) {
  redirect(`/academy/cursos/${courseSlug}/capitulos/${chapterId}?error=${error}`);
}

export async function completeAcademyChapterAction(formData: FormData) {
  const courseSlug = getString(formData, "course_slug");
  const chapterId = getString(formData, "chapter_id");
  const optionId = getString(formData, "checkpoint_option_id");
  const course = getAcademyCourse(courseSlug);
  const chapter = course ? getAcademyChapter(course.slug, chapterId) : null;

  if (!course || !chapter) {
    redirect("/academy?error=chapter_not_found");
  }

  const answer = getAcademyQuestionAnswer(chapter.checkpoint, optionId);

  if (!answer?.isCorrect) {
    redirectWithAcademyError(course.slug, chapter.id, "checkpoint");
  }

  const { supabase, companyId, userProfileId } = await getCurrentUserContext();
  const now = new Date().toISOString();
  const { data: existingProgress } = await supabase
    .from("academy_chapter_progress")
    .select("status, best_score, completed_at")
    .eq("company_id", companyId)
    .eq("user_profile_id", userProfileId)
    .eq("course_slug", course.slug)
    .eq("chapter_id", chapter.id)
    .maybeSingle();
  const keepApproved =
    (existingProgress as { status?: string } | null)?.status === "approved";
  const { error } = await supabase.from("academy_chapter_progress").upsert(
    {
      company_id: companyId,
      user_profile_id: userProfileId,
      course_slug: course.slug,
      chapter_id: chapter.id,
      status: keepApproved ? "approved" : "completed",
      progress_percent: 100,
      best_score:
        (existingProgress as { best_score?: number | null } | null)?.best_score ??
        null,
      completed_at:
        (existingProgress as { completed_at?: string | null } | null)?.completed_at ??
        now,
      last_activity_at: now,
      updated_at: now,
    },
    {
      onConflict: "company_id,user_profile_id,course_slug,chapter_id",
    },
  );

  if (error) {
    if (isAcademyMissingTableError(error)) {
      redirectWithAcademyError(course.slug, chapter.id, "sql");
    }

    redirectWithAcademyError(course.slug, chapter.id, "save");
  }

  revalidatePath("/academy");
  revalidatePath(`/academy/cursos/${course.slug}`);
  revalidatePath(`/academy/cursos/${course.slug}/capitulos/${chapter.id}`);
  revalidatePath("/academy/gestao");
  redirect(`/academy/cursos/${course.slug}/capitulos/${chapter.id}?status=completed`);
}

export async function submitAcademyExamAction(formData: FormData) {
  const courseSlug = getString(formData, "course_slug");
  const chapterId = getString(formData, "chapter_id");
  const course = getAcademyCourse(courseSlug);
  const chapter = course ? getAcademyChapter(course.slug, chapterId) : null;

  if (!course || !chapter) {
    redirect("/academy?error=chapter_not_found");
  }

  const answers = Object.fromEntries(
    chapter.exam.map((question) => [
      question.id,
      getString(formData, `question_${question.id}`),
    ]),
  );
  const missingAnswer = chapter.exam.some((question) => !answers[question.id]);

  if (missingAnswer) {
    redirectWithAcademyError(course.slug, chapter.id, "missing_answers");
  }

  const total = chapter.exam.length;
  const correct = chapter.exam.filter((question) => {
    const option = getAcademyQuestionAnswer(question, answers[question.id]);
    return option?.isCorrect;
  }).length;
  const score = Math.round((correct / Math.max(total, 1)) * 100);
  const passed = score >= course.passingScore;
  const { supabase, companyId, userProfileId } = await getCurrentUserContext();
  const now = new Date().toISOString();
  const { data: existingProgress } = await supabase
    .from("academy_chapter_progress")
    .select("status, best_score, completed_at")
    .eq("company_id", companyId)
    .eq("user_profile_id", userProfileId)
    .eq("course_slug", course.slug)
    .eq("chapter_id", chapter.id)
    .maybeSingle();

  const { error: attemptError } = await supabase.from("academy_exam_attempts").insert({
    company_id: companyId,
    user_profile_id: userProfileId,
    course_slug: course.slug,
    chapter_id: chapter.id,
    score,
    passed,
    answers,
    submitted_at: now,
  });

  if (attemptError) {
    if (isAcademyMissingTableError(attemptError)) {
      redirectWithAcademyError(course.slug, chapter.id, "sql");
    }

    redirectWithAcademyError(course.slug, chapter.id, "save");
  }

  const previousProgress = existingProgress as {
    status?: string | null;
    best_score?: number | null;
    completed_at?: string | null;
  } | null;
  const bestScore = Math.max(previousProgress?.best_score ?? 0, score);
  const keepApproved = passed || previousProgress?.status === "approved";
  const { error: progressError } = await supabase
    .from("academy_chapter_progress")
    .upsert(
      {
        company_id: companyId,
        user_profile_id: userProfileId,
        course_slug: course.slug,
        chapter_id: chapter.id,
        status: keepApproved ? "approved" : "completed",
        progress_percent: 100,
        best_score: bestScore,
        completed_at: previousProgress?.completed_at ?? now,
        last_activity_at: now,
        updated_at: now,
      },
      {
        onConflict: "company_id,user_profile_id,course_slug,chapter_id",
      },
    );

  if (progressError) {
    redirectWithAcademyError(course.slug, chapter.id, "save");
  }

  revalidatePath("/academy");
  revalidatePath(`/academy/cursos/${course.slug}`);
  revalidatePath(`/academy/cursos/${course.slug}/capitulos/${chapter.id}`);
  revalidatePath("/academy/gestao");
  redirect(
    `/academy/cursos/${course.slug}/capitulos/${chapter.id}?status=exam&score=${score}&passed=${passed ? "1" : "0"}`,
  );
}
