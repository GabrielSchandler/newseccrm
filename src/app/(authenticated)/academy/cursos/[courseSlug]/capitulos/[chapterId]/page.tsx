import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Award, BookOpen, CheckCircle2, Clock } from "lucide-react";
import {
  completeAcademyChapterAction,
  submitAcademyExamAction,
} from "@/app/(authenticated)/academy/actions";
import {
  getAcademyChapter,
  getAcademyCourse,
  getNextAcademyChapter,
} from "@/lib/academy/course";
import { loadAcademyUserProgress } from "@/lib/academy/service";
import { getCurrentUserContext } from "@/lib/auth/current-user";

function messageForError(error: string | string[] | undefined) {
  if (error === "checkpoint") {
    return "A resposta do checkpoint não está correta. Revise o conteúdo e tente novamente.";
  }

  if (error === "missing_answers") {
    return "Responda todas as perguntas da prova antes de enviar.";
  }

  if (error === "sql") {
    return "As tabelas do Academy ainda não existem no Supabase. Rode o SQL informado para salvar progresso e notas.";
  }

  if (error === "save") {
    return "Não foi possível salvar o progresso agora. Tente novamente em instantes.";
  }

  return null;
}

export default async function AcademyChapterPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string; chapterId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { courseSlug, chapterId } = await params;
  const query = (await searchParams) ?? {};
  const course = getAcademyCourse(courseSlug);
  const chapter = course ? getAcademyChapter(course.slug, chapterId) : null;

  if (!course || !chapter) {
    notFound();
  }

  const { supabase, companyId, userProfileId } = await getCurrentUserContext();
  const progress = await loadAcademyUserProgress({
    supabase,
    companyId,
    userProfileId,
    course,
  });
  const status = progress.statuses.find((item) => item.chapter.id === chapter.id);
  const nextChapter = getNextAcademyChapter(course.slug, chapter.id);
  const errorMessage = messageForError(query.error);
  const score = typeof query.score === "string" ? query.score : null;
  const passed = query.passed === "1";

  return (
    <main className="min-h-screen bg-slate-100">
      <section className="border-b border-slate-200 bg-white px-6 py-8">
        <Link
          href={`/academy/cursos/${course.slug}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-900"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Voltar para {course.title}
        </Link>
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
              {course.title}
            </p>
            <h1 className="mt-2 max-w-5xl text-3xl font-semibold leading-tight text-slate-950">
              {chapter.title}
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              {chapter.objective}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <Clock aria-hidden="true" className="h-5 w-5 text-teal-700" />
              <div>
                <p className="text-sm font-medium text-slate-600">Tempo estimado</p>
                <p className="font-semibold text-slate-950">
                  {chapter.estimatedMinutes} min
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Award aria-hidden="true" className="h-5 w-5 text-teal-700" />
              <div>
                <p className="text-sm font-medium text-slate-600">Aprovacao</p>
                <p className="font-semibold text-slate-950">
                  {course.passingScore}% ou mais
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6 p-6">
        {errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {score ? (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              passed
                ? "border-teal-200 bg-teal-50 text-teal-800"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            Sua nota foi {score}%.{" "}
            {passed
              ? "Módulo aprovado."
              : "Revise os pontos principais e envie a prova novamente."}
          </div>
        ) : null}

        <article className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            {chapter.sections.map((section) => (
              <section
                key={section.title}
                className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
                    <BookOpen aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <h2 className="text-xl font-semibold text-slate-950">
                    {section.title}
                  </h2>
                </div>
                <div className="space-y-4 text-sm leading-7 text-slate-700">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="space-y-4">
            <section className="rounded-lg border border-teal-200 bg-teal-50 p-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-teal-800" />
                <h2 className="text-base font-semibold text-teal-950">
                  Checkpoint do módulo
                </h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-teal-950">
                {chapter.checkpoint.prompt}
              </p>
              <form action={completeAcademyChapterAction} className="mt-4 space-y-3">
                <input type="hidden" name="course_slug" value={course.slug} />
                <input type="hidden" name="chapter_id" value={chapter.id} />
                {chapter.checkpoint.options.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-teal-200 bg-white p-3 text-sm text-slate-700 transition hover:border-teal-400"
                  >
                    <input
                      required
                      type="radio"
                      name="checkpoint_option_id"
                      value={option.id}
                      className="mt-1 h-4 w-4 border-slate-300 text-teal-700 focus:ring-teal-600"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
                <button
                  type="submit"
                  className="inline-flex w-full justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
                >
                  Marcar como estudado
                </button>
              </form>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-950">
                Prova rapida
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Registre a nota de conclusao deste módulo. O gestor acompanha
                esse resultado na área de gestão.
              </p>
              <form action={submitAcademyExamAction} className="mt-4 space-y-5">
                <input type="hidden" name="course_slug" value={course.slug} />
                <input type="hidden" name="chapter_id" value={chapter.id} />
                {chapter.exam.map((question, index) => (
                  <fieldset key={question.id} className="space-y-3">
                    <legend className="text-sm font-semibold text-slate-950">
                      {index + 1}. {question.prompt}
                    </legend>
                    {question.options.map((option) => (
                      <label
                        key={option.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 transition hover:border-teal-300"
                      >
                        <input
                          required
                          type="radio"
                          name={`question_${question.id}`}
                          value={option.id}
                          className="mt-1 h-4 w-4 border-slate-300 text-teal-700 focus:ring-teal-600"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </fieldset>
                ))}
                <button
                  type="submit"
                  className="inline-flex w-full justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Enviar prova
                </button>
              </form>
            </section>

            {status?.approved && nextChapter ? (
              <Link
                href={`/academy/cursos/${course.slug}/capitulos/${nextChapter.id}`}
                className="inline-flex w-full justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Próximo módulo
              </Link>
            ) : null}
          </aside>
        </article>
      </section>
    </main>
  );
}
