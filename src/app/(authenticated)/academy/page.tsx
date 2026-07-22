import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { academyCourses } from "@/lib/academy/course";
import {
  loadAcademyUserProgress,
  summarizeAcademyProgress,
} from "@/lib/academy/service";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  isModuleEnabled,
  loadCompanyPlatformSettings,
} from "@/lib/company/platform-settings";
import type { AcademyCourse } from "@/types/academy";

function percentBar(value: number) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-teal-700"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}

function courseAccent(index: number) {
  return index % 2 === 0
    ? "border-teal-200 bg-teal-50 text-teal-800"
    : "border-red-200 bg-red-50 text-red-700";
}

function CourseCard({
  course,
  index,
  progress,
}: {
  course: AcademyCourse;
  index: number;
  progress: Awaited<ReturnType<typeof loadAcademyUserProgress>>;
}) {
  const summary = summarizeAcademyProgress(progress.statuses);
  const firstPending =
    progress.statuses.find((status) => !status.approved)?.chapter ??
    course.chapters[0];
  const href = `/academy/cursos/${course.slug}`;
  const continueHref = firstPending
    ? `/academy/cursos/${course.slug}/capitulos/${firstPending.id}`
    : href;

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${courseAccent(index)}`}
            >
              {course.subtitle}
            </span>
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">
              {course.title}
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              {course.description}
            </p>
          </div>
          <Link
            href={continueHref}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            {summary.completedChapters > 0 ? "Continuar curso" : "Iniciar curso"}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">Seu progresso</span>
            <span className="font-semibold tabular-nums text-teal-800">
              {summary.progressPercent}%
            </span>
          </div>
          {percentBar(summary.progressPercent)}
        </div>
      </div>

      <div className="grid border-t border-slate-100 bg-slate-50 md:grid-cols-4">
        <div className="border-b border-slate-100 p-4 md:border-b-0 md:border-r">
          <Clock aria-hidden="true" className="h-5 w-5 text-teal-700" />
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Carga
          </p>
          <p className="text-lg font-semibold text-slate-950">
            {Math.round(course.estimatedMinutes / 60)}h
          </p>
        </div>
        <div className="border-b border-slate-100 p-4 md:border-b-0 md:border-r">
          <BookOpenCheck aria-hidden="true" className="h-5 w-5 text-teal-700" />
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Modulos
          </p>
          <p className="text-lg font-semibold text-slate-950">
            {course.chapters.length}
          </p>
        </div>
        <div className="border-b border-slate-100 p-4 md:border-b-0 md:border-r">
          <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-teal-700" />
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Concluidos
          </p>
          <p className="text-lg font-semibold text-slate-950">
            {summary.completedChapters}/{course.chapters.length}
          </p>
        </div>
        <div className="p-4">
          <GraduationCap aria-hidden="true" className="h-5 w-5 text-teal-700" />
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Nota media
          </p>
          <p className="text-lg font-semibold text-slate-950">
            {summary.averageScore === null ? "-" : `${summary.averageScore}%`}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-6 text-slate-600">{course.audience}</p>
        <Link
          href={href}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
        >
          Ver trilha completa
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

export default async function AcademyPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const { supabase, companyId, fullName, userProfileId } =
    await getCurrentUserContext();
  const { settings } = await loadCompanyPlatformSettings(supabase, companyId);

  if (!isModuleEnabled(settings, "academy")) {
    return (
      <main className="min-h-screen bg-slate-100">
        <section className="border-b border-slate-200 bg-white px-6 py-8">
          <p className="text-sm font-medium text-teal-700">CRM SaaS</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Academy</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            O módulo Academy ainda não está habilitado para esta empresa.
          </p>
        </section>
      </main>
    );
  }

  const courseProgress = await Promise.all(
    academyCourses.map(async (course) => ({
      course,
      progress: await loadAcademyUserProgress({
        supabase,
        companyId,
        userProfileId,
        course,
      }),
    })),
  );
  const tableReady = courseProgress.every((item) => item.progress.tableReady);
  const errorMessage =
    courseProgress.find((item) => item.progress.errorMessage)?.progress.errorMessage ??
    null;

  return (
    <main className="min-h-screen bg-slate-100">
      <section className="border-b border-slate-200 bg-white px-6 py-8">
        <p className="text-sm font-medium text-teal-700">CRM SaaS</p>
        <div className="mt-2 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
          <div>
            <h1 className="text-3xl font-semibold text-slate-950">Academy</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Escolha uma trilha para evoluir com foco. A formacao comercial
              ensina venda consultiva revisional. A trilha de CRM ensina uso
              profissional da plataforma, registros, documentos e segurança.
            </p>
          </div>
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 text-teal-800" />
              <div>
                <p className="font-semibold text-teal-950">
                  Olá, {fullName || "usuario"}.
                </p>
                <p className="mt-1 text-sm leading-6 text-teal-900">
                  Seu progresso fica separado por curso para a gestão acompanhar
                  com mais precisao.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6 p-6">
        {!tableReady || params.error === "sql" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            O banco ainda não possui as tabelas do Academy. Rode o SQL
            `docs/sql/academy-crm.sql` no Supabase para salvar progresso,
            provas e relatórios.
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-5">
          {courseProgress.map(({ course, progress }, index) => (
            <CourseCard
              key={course.slug}
              course={course}
              index={index}
              progress={progress}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
