import { updateCompanyPlatformSettingsAction } from "@/app/(authenticated)/empresas/actions";
import {
  companyModuleDefinitions,
  companyPlatformStatusOptions,
  formatStorageLimit,
  getCompanyPlatformStatusMeta,
} from "@/lib/company/platform-settings";
import type { CompanyPlatformSettings } from "@/types/company";

type CompanyPlatformSettingsFormProps = {
  companyId: string;
  companyName: string;
  settings: CompanyPlatformSettings;
  licenseLimit: number;
  settingsTableReady: boolean;
};

function moduleGroups() {
  return [
    {
      key: "operacao",
      label: "Operação principal",
      description: "Modulos que aparecem para a equipe no uso diario.",
    },
    {
      key: "crescimento",
      label: "Crescimento e escala",
      description: "Recursos para entrada de leads, portal e treinamento.",
    },
    {
      key: "gestao",
      label: "Governanca",
      description: "Recursos administrativos, segurança e padronizacao.",
    },
  ] as const;
}

export function CompanyPlatformSettingsForm({
  companyId,
  companyName,
  settings,
  licenseLimit,
  settingsTableReady,
}: CompanyPlatformSettingsFormProps) {
  const currentStatus = getCompanyPlatformStatusMeta(settings.status);
  const modulesByGroup = moduleGroups().map((group) => ({
    ...group,
    modules: companyModuleDefinitions.filter((module) => module.group === group.key),
  }));

  return (
    <form
      action={updateCompanyPlatformSettingsAction}
      className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <input type="hidden" name="company_id" value={companyId} />

      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            Configuração SaaS
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Plano e modulos da empresa
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Defina o que a {companyName} pode usar no CRM, quais limites foram
            contratados e quais recursos ficam prontos para expansao futura.
          </p>
        </div>
        <span
          className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            currentStatus.tone === "success"
              ? "border-teal-200 bg-teal-50 text-teal-800"
              : currentStatus.tone === "info"
                ? "border-sky-200 bg-sky-50 text-sky-800"
                : currentStatus.tone === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {currentStatus.label}
        </span>
      </div>

      {!settingsTableReady ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          A tabela de configurações ainda não existe no Supabase. Esta tela esta
          usando padrões temporarios; rode o SQL desta entrega para salvar as
          configurações.
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[220px_220px_minmax(0,1fr)]">
        <label className="space-y-2 text-sm font-medium text-slate-700">
          <span>Status da empresa</span>
          <select
            name="status"
            defaultValue={String(settings.status ?? "active")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          >
            {companyPlatformStatusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm font-medium text-slate-700">
          <span>Usuários contratados</span>
          <input
            name="user_license_limit"
            type="number"
            min={1}
            max={10000}
            defaultValue={licenseLimit || 10}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </label>

        <label className="space-y-2 text-sm font-medium text-slate-700">
          <span>Limite de armazenamento</span>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <input
              name="storage_limit_mb"
              type="number"
              min={100}
              max={1024 * 1024}
              defaultValue={settings.storage_limit_mb ?? 10240}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            />
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
              Atual: {formatStorageLimit(settings.storage_limit_mb)}
            </div>
          </div>
        </label>
      </section>

      <section className="grid gap-4">
        {modulesByGroup.map((group) => (
          <div key={group.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-slate-950">
                {group.label}
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {group.description}
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {group.modules.map((module) => {
                const enabled = settings[module.field] !== false;

                return (
                  <label
                    key={module.key}
                    className={`group flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-4 transition hover:border-teal-300 ${
                      enabled
                        ? "border-teal-200 shadow-sm"
                        : "border-slate-200 opacity-80"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name={module.field}
                      defaultChecked={enabled}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-950">
                          {module.label}
                        </span>
                        {module.preparedOnly ? (
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            Preparado
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-slate-600">
                        {module.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <label className="block space-y-2 text-sm font-medium text-slate-700">
        <span>Observações internas</span>
        <textarea
          name="notes"
          rows={4}
          defaultValue={settings.notes ?? ""}
          placeholder="Ex.: empresa em onboarding, pacote contratado, observações comerciais ou restrições combinadas."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        />
      </label>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-500">
          As alterações ficam registradas na empresa e podem controlar o que aparece
          para os usuários na entrada do CRM.
        </p>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
        >
          Salvar configurações
        </button>
      </div>
    </form>
  );
}
