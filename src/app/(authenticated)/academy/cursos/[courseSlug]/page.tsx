import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
} from "lucide-react";
import { getAcademyCourse } from "@/lib/academy/course";
import {
  loadAcademyUserProgress,
  summarizeAcademyProgress,
} from "@/lib/academy/service";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  isModuleEnabled,
  loadCompanyPlatformSettings,
} from "@/lib/company/platform-settings";

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

export default async function AcademyCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { courseSlug } = await params;
  const query = (await searchParams) ?? {};
  const course = getAcademyCourse(courseSlug);

  if (!course) {
    notFound();
  }

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

  const progress = await loadAcademyUserProgress({
    supabase,
    companyId,
    userProfileId,
    course,
  });
  const summary = summarizeAcademyProgress(progress.statuses);
  const firstPending =
    progress.statuses.find((status) => !status.approved)?.chapter ??
    course.chapters[0];

  return (
    <main className="min-h-screen bg-slate-100">
      <section className="border-b border-slate-200 bg-white px-6 py-8">
        <Link
          href="/academy"
          className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-900"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Voltar para catalogo
        </Link>
        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
              {course.subtitle}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">
              {course.title}
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              {course.description}
            </p>
          </div>
          <Link
            href={`/academy/cursos/${course.slug}/capitulos/${firstPending.id}`}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            {summary.completedChapters > 0 ? "Continuar curso" : "Iniciar curso"}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="space-y-6 p-6">
        {!progress.tableReady || query.error === "sql" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            O banco ainda não possui as tabelas do Academy. Rode o SQL
            `docs/sql/academy-crm.sql` no Supabase para salvar progresso,
            provas e relatórios.
          </div>
        ) : null}

        {progress.errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {progress.errorMessage}
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <span className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-800">
                Trilha independente
              </span>
              <h2 className="mt-4 max-w-4xl text-3xl font-semibold text-slate-950">
                Progresso de {fullName || "usuario"}
              </h2>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                {course.audience}
              </p>
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">Progresso</span>
                  <span className="font-semibold tabular-nums text-teal-800">
                    {summary.progressPercent}%
                  </span>
                </div>
                {percentBar(summary.progressPercent)}
              </div>
            </div>
            <div className="grid gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <Clock aria-hidden="true" className="h-5 w-5 text-teal-700" />
                <p className="mt-3 text-sm font-medium text-slate-600">
                  Carga estimada
                </p>
                <p className="text-2xl font-semibold text-slate-950">
                  {Math.round(course.estimatedMinutes / 60)}h
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-teal-700" />
                <p className="mt-3 text-sm font-medium text-slate-600">
                  Modulos concluidos
                </p>
                <p className="text-2xl font-semibold text-slate-950">
                  {summary.completedChapters}/{course.chapters.length}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <GraduationCap aria-hidden="true" className="h-5 w-5 text-teal-700" />
                <p className="mt-3 text-sm font-medium text-slate-600">Nota media</p>
                <p className="text-2xl font-semibold text-slate-950">
                  {summary.averageScore === null ? "-" : `${summary.averageScore}%`}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {progress.statuses.map(({ chapter, score, approved, completed }, index) => (
            <Link
              key={chapter.id}
              href={`/academy/cursos/${course.slug}/capitulos/${chapter.id}`}
              className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-sm font-semibold text-teal-800">
                  {index + 1}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    approved
                      ? "bg-teal-50 text-teal-800"
                      : completed
                        ? "bg-amber-50 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {approved ? "Aprovado" : completed ? "Estudado" : "Pendente"}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold leading-7 text-slate-950">
                {chapter.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {chapter.objective}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <BookOpenCheck aria-hidden="true" className="h-4 w-4 text-teal-700" />
                  {chapter.estimatedMinutes} min
                </span>
                <span className="font-semibold text-slate-950">
                  {score === null
                    ? approved
                      ? "Aprovado"
                      : completed
                        ? "Estudado"
                        : "Sem nota"
                    : `${score}%`}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
