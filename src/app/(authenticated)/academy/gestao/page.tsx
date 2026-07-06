import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Award,
  BookOpenCheck,
  Clock,
  GraduationCap,
  Layers3,
  Users,
} from "lucide-react";
import { academyCourses } from "@/lib/academy/course";
import { loadAcademyReport } from "@/lib/academy/service";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  isModuleEnabled,
  loadCompanyPlatformSettings,
} from "@/lib/company/platform-settings";
import type { AcademyCourse, AcademyReportRow } from "@/types/academy";
import { formatCompanyBusinessArea, formatCompanyUserRole } from "@/types/user";

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number");

  if (!valid.length) {
    return null;
  }

  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

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

function statusBadge(status: "not_started" | "in_progress" | "approved") {
  const meta = {
    not_started: {
      label: "Nao iniciado",
      className: "bg-slate-100 text-slate-700",
    },
    in_progress: {
      label: "Em andamento",
      className: "bg-amber-50 text-amber-800",
    },
    approved: {
      label: "Concluido",
      className: "bg-teal-50 text-teal-800",
    },
  }[status];

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function CourseManagementBlock({
  course,
  rows,
}: {
  course: AcademyCourse;
  rows: AcademyReportRow[];
}) {
  const totalUsers = rows.length;
  const completedUsers = rows.filter((row) => row.status === "approved").length;
  const inProgressUsers = rows.filter((row) => row.status === "in_progress").length;
  const notStartedUsers = rows.filter((row) => row.status === "not_started").length;
  const averageScore = average(rows.map((row) => row.averageScore));
  const averageProgress = totalUsers
    ? Math.round(rows.reduce((sum, row) => sum + row.progressPercent, 0) / totalUsers)
    : 0;

  return (
    <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
        <div>
          <span className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-800">
            {course.subtitle}
          </span>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">
            {course.title}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            {course.description}
          </p>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">
                Progresso medio da equipe
              </span>
              <span className="font-semibold tabular-nums text-teal-800">
                {averageProgress}%
              </span>
            </div>
            {percentBar(averageProgress)}
          </div>
        </div>
        <Link
          href={`/academy/cursos/${course.slug}`}
          className="inline-flex justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
        >
          Abrir trilha
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <Users aria-hidden="true" className="h-5 w-5 text-teal-700" />
          <p className="mt-3 text-sm font-medium text-slate-600">Usuarios</p>
          <p className="text-2xl font-semibold text-slate-950">{totalUsers}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <BookOpenCheck aria-hidden="true" className="h-5 w-5 text-teal-700" />
          <p className="mt-3 text-sm font-medium text-slate-600">Em andamento</p>
          <p className="text-2xl font-semibold text-slate-950">{inProgressUsers}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <Award aria-hidden="true" className="h-5 w-5 text-teal-700" />
          <p className="mt-3 text-sm font-medium text-slate-600">Concluidos</p>
          <p className="text-2xl font-semibold text-slate-950">{completedUsers}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <GraduationCap aria-hidden="true" className="h-5 w-5 text-teal-700" />
          <p className="mt-3 text-sm font-medium text-slate-600">Nota media</p>
          <p className="text-2xl font-semibold text-slate-950">
            {averageScore === null ? "-" : `${averageScore}%`}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <Clock aria-hidden="true" className="h-5 w-5 text-teal-700" />
          <p className="mt-3 text-sm font-medium text-slate-600">Nao iniciados</p>
          <p className="text-2xl font-semibold text-slate-950">{notStartedUsers}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-950">
            Progresso dos usuarios
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Acompanhamento separado desta trilha.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-white text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Usuario</th>
                <th className="px-5 py-3">Area</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Progresso</th>
                <th className="px-5 py-3">Nota media</th>
                <th className="px-5 py-3">Ultima atividade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row) => (
                <tr key={`${course.slug}-${row.userId}`} className="align-top">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-950">{row.fullName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.email ?? "Email nao informado"}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    <p>{formatCompanyBusinessArea(row.businessArea)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatCompanyUserRole(row.role)}
                    </p>
                  </td>
                  <td className="px-5 py-4">{statusBadge(row.status)}</td>
                  <td className="w-64 px-5 py-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-500">
                        {row.completedChapters}/{course.chapters.length} estudados
                      </span>
                      <span className="font-semibold text-slate-950">
                        {row.progressPercent}%
                      </span>
                    </div>
                    {percentBar(row.progressPercent)}
                    <p className="mt-2 text-xs text-slate-500">
                      {row.approvedChapters} modulo(s) aprovado(s)
                    </p>
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-950">
                    {row.averageScore === null ? "-" : `${row.averageScore}%`}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {formatDateTime(row.lastActivityAt)}
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    Nenhum usuario ativo encontrado para acompanhar.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default async function AcademyManagementPage() {
  const context = await getCurrentUserContext();
  const { supabase, companyId, role, isPlatformOwner } = context;
  const canManage = role === "admin" || role === "manager" || isPlatformOwner;

  if (!canManage) {
    redirect("/academy");
  }

  const { settings } = await loadCompanyPlatformSettings(supabase, companyId);

  if (!isModuleEnabled(settings, "academy")) {
    return (
      <main className="min-h-screen bg-slate-100">
        <section className="border-b border-slate-200 bg-white px-6 py-8">
          <p className="text-sm font-medium text-teal-700">CRM SaaS</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            Academy
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            O modulo Academy ainda nao esta habilitado para esta empresa.
          </p>
        </section>
      </main>
    );
  }

  const reports = await Promise.all(
    academyCourses.map(async (course) => ({
      course,
      report: await loadAcademyReport({ supabase, companyId, course }),
    })),
  );
  const hasMissingTable = reports.some((item) => !item.report.tableReady);
  const errorMessage =
    reports.find((item) => item.report.errorMessage)?.report.errorMessage ?? null;
  const allRows = reports.flatMap((item) => item.report.rows);
  const uniqueUsers = new Set(allRows.map((row) => row.userId)).size;
  const averageProgress = allRows.length
    ? Math.round(
        allRows.reduce((sum, row) => sum + row.progressPercent, 0) /
          allRows.length,
      )
    : 0;

  return (
    <main className="min-h-screen bg-slate-100">
      <section className="border-b border-slate-200 bg-white px-6 py-8">
        <p className="text-sm font-medium text-teal-700">CRM SaaS</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-950">
              Academy da gestao
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Acompanhe trilhas separadas por curso: Comercial GRS e Operacao
              do CRM GRS.
            </p>
          </div>
          <Link
            href="/academy"
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            Abrir catalogo
          </Link>
        </div>
      </section>

      <section className="space-y-6 p-6">
        {hasMissingTable ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            O banco ainda nao possui as tabelas do Academy. Rode o SQL
            `docs/sql/academy-crm.sql` no Supabase para salvar progresso,
            provas e relatorios.
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <Layers3 aria-hidden="true" className="h-5 w-5 text-teal-700" />
            <p className="mt-3 text-sm font-medium text-slate-600">Cursos</p>
            <p className="text-2xl font-semibold text-slate-950">
              {academyCourses.length}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <Users aria-hidden="true" className="h-5 w-5 text-teal-700" />
            <p className="mt-3 text-sm font-medium text-slate-600">
              Usuarios ativos
            </p>
            <p className="text-2xl font-semibold text-slate-950">{uniqueUsers}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <BookOpenCheck aria-hidden="true" className="h-5 w-5 text-teal-700" />
            <p className="mt-3 text-sm font-medium text-slate-600">
              Progresso medio
            </p>
            <p className="text-2xl font-semibold text-slate-950">
              {averageProgress}%
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <Clock aria-hidden="true" className="h-5 w-5 text-teal-700" />
            <p className="mt-3 text-sm font-medium text-slate-600">
              Carga total
            </p>
            <p className="text-2xl font-semibold text-slate-950">
              {Math.round(
                academyCourses.reduce(
                  (sum, course) => sum + course.estimatedMinutes,
                  0,
                ) / 60,
              )}
              h
            </p>
          </div>
        </div>

        {reports.map(({ course, report }) => (
          <CourseManagementBlock
            key={course.slug}
            course={course}
            rows={report.rows}
          />
        ))}
      </section>
    </main>
  );
}
