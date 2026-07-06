import Link from "next/link";
import { redirect } from "next/navigation";
import { Award, BookOpenCheck, Clock, GraduationCap, Users } from "lucide-react";
import { academyCourse } from "@/lib/academy/course";
import { loadAcademyReport } from "@/lib/academy/service";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  isModuleEnabled,
  loadCompanyPlatformSettings,
} from "@/lib/company/platform-settings";
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

  const report = await loadAcademyReport({ supabase, companyId });
  const totalUsers = report.rows.length;
  const completedUsers = report.rows.filter((row) => row.status === "approved").length;
  const inProgressUsers = report.rows.filter((row) => row.status === "in_progress").length;
  const averageScore = average(report.rows.map((row) => row.averageScore));
  const averageProgress = totalUsers
    ? Math.round(
        report.rows.reduce((sum, row) => sum + row.progressPercent, 0) / totalUsers,
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
              Acompanhe quem esta estudando, progresso por usuario e nota de
              conclusao do treinamento comercial.
            </p>
          </div>
          <Link
            href="/academy"
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            Abrir curso
          </Link>
        </div>
      </section>

      <section className="space-y-6 p-6">
        {!report.tableReady ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            O banco ainda nao possui as tabelas do Academy. Rode o SQL
            `docs/sql/academy-crm.sql` no Supabase para salvar progresso,
            provas e relatorios.
          </div>
        ) : null}

        {report.errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {report.errorMessage}
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <span className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-800">
                {academyCourse.subtitle}
              </span>
              <h2 className="mt-4 max-w-4xl text-3xl font-semibold text-slate-950">
                {academyCourse.title}
              </h2>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                Relatorio consolidado por empresa. A trilha pode ser usada por
                consultores comerciais, juridicos e liderancas.
              </p>
              <div className="mt-6">
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
            <div className="grid gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <Users aria-hidden="true" className="h-5 w-5 text-teal-700" />
                <p className="mt-3 text-sm font-medium text-slate-600">
                  Usuarios ativos
                </p>
                <p className="text-2xl font-semibold text-slate-950">
                  {totalUsers}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <BookOpenCheck aria-hidden="true" className="h-5 w-5 text-teal-700" />
                <p className="mt-3 text-sm font-medium text-slate-600">
                  Em andamento
                </p>
                <p className="text-2xl font-semibold text-slate-950">
                  {inProgressUsers}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <Award aria-hidden="true" className="h-5 w-5 text-teal-700" />
                <p className="mt-3 text-sm font-medium text-slate-600">
                  Concluidos
                </p>
                <p className="text-2xl font-semibold text-slate-950">
                  {completedUsers}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <GraduationCap aria-hidden="true" className="h-5 w-5 text-teal-700" />
            <p className="mt-3 text-sm font-medium text-slate-600">
              Nota media
            </p>
            <p className="text-2xl font-semibold text-slate-950">
              {averageScore === null ? "-" : `${averageScore}%`}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <Clock aria-hidden="true" className="h-5 w-5 text-teal-700" />
            <p className="mt-3 text-sm font-medium text-slate-600">
              Carga do curso
            </p>
            <p className="text-2xl font-semibold text-slate-950">
              {Math.round(academyCourse.estimatedMinutes / 60)}h
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <BookOpenCheck aria-hidden="true" className="h-5 w-5 text-teal-700" />
            <p className="mt-3 text-sm font-medium text-slate-600">
              Capitulos
            </p>
            <p className="text-2xl font-semibold text-slate-950">
              {academyCourse.chapters.length}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <Users aria-hidden="true" className="h-5 w-5 text-teal-700" />
            <p className="mt-3 text-sm font-medium text-slate-600">
              Nao iniciados
            </p>
            <p className="text-2xl font-semibold text-slate-950">
              {report.rows.filter((row) => row.status === "not_started").length}
            </p>
          </div>
        </div>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-950">
              Progresso dos usuarios
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Ranking operacional para acompanhar conclusao e necessidade de
              reforco.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Usuario</th>
                  <th className="px-5 py-3">Area</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Progresso</th>
                  <th className="px-5 py-3">Nota media</th>
                  <th className="px-5 py-3">Ultima atividade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.map((row) => (
                  <tr key={row.userId} className="align-top">
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
                          {row.completedChapters}/{academyCourse.chapters.length} estudados
                        </span>
                        <span className="font-semibold text-slate-950">
                          {row.progressPercent}%
                        </span>
                      </div>
                      {percentBar(row.progressPercent)}
                      <p className="mt-2 text-xs text-slate-500">
                        {row.approvedChapters} capitulo(s) aprovado(s)
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
                {!report.rows.length ? (
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
        </section>
      </section>
    </main>
  );
}
