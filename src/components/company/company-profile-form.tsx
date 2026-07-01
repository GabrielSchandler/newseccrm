"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormFieldLabel } from "@/components/form-field-label";
import {
  updateCompanyProfileAction,
  type CompanyActionState,
} from "@/app/(authenticated)/empresa/actions";

type CompanyProfileFormDefaults = {
  legal_name: string;
  trade_name: string;
  cnpj: string;
  email: string;
  phone: string;
  website: string;
  zip_code: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  simulation_guarantee_title: string;
  simulation_guarantee_lead: string;
  simulation_guarantee_clause_label: string;
  simulation_guarantee_clause_text: string;
};

type CompanyProfileFormProps = {
  defaultValues: CompanyProfileFormDefaults;
};

export function CompanyProfileForm({ defaultValues }: CompanyProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<CompanyActionState | null>(null);

  return (
    <form
      className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        setState(null);
        startTransition(async () => {
          const result = await updateCompanyProfileAction({
            legal_name: String(formData.get("legal_name") ?? ""),
            trade_name: String(formData.get("trade_name") ?? ""),
            cnpj: String(formData.get("cnpj") ?? ""),
            email: String(formData.get("email") ?? ""),
            phone: String(formData.get("phone") ?? ""),
            website: String(formData.get("website") ?? ""),
            zip_code: String(formData.get("zip_code") ?? ""),
            street: String(formData.get("street") ?? ""),
            number: String(formData.get("number") ?? ""),
            district: String(formData.get("district") ?? ""),
            city: String(formData.get("city") ?? ""),
            state: String(formData.get("state") ?? ""),
            simulation_guarantee_title: String(
              formData.get("simulation_guarantee_title") ?? "",
            ),
            simulation_guarantee_lead: String(
              formData.get("simulation_guarantee_lead") ?? "",
            ),
            simulation_guarantee_clause_label: String(
              formData.get("simulation_guarantee_clause_label") ?? "",
            ),
            simulation_guarantee_clause_text: String(
              formData.get("simulation_guarantee_clause_text") ?? "",
            ),
          });

          setState(result);

          if (result.ok && result.redirectTo) {
            router.push(result.redirectTo);
            router.refresh();
          }
        });
      }}
    >
      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 text-sm text-slate-700">
          <FormFieldLabel label="Razao social" requirement="optional" />
          <input
            name="legal_name"
            defaultValue={defaultValues.legal_name}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </div>
        <div className="space-y-2 text-sm text-slate-700">
          <FormFieldLabel label="Nome fantasia" requirement="optional" />
          <input
            name="trade_name"
            defaultValue={defaultValues.trade_name}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </div>
        <div className="space-y-2 text-sm text-slate-700">
          <FormFieldLabel label="CNPJ" requirement="optional" />
          <input
            name="cnpj"
            defaultValue={defaultValues.cnpj}
            placeholder="Somente numeros ou formatado"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </div>
        <div className="space-y-2 text-sm text-slate-700">
          <FormFieldLabel label="Telefone" requirement="optional" />
          <input
            name="phone"
            defaultValue={defaultValues.phone}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </div>
        <div className="space-y-2 text-sm text-slate-700">
          <FormFieldLabel label="E-mail" requirement="optional" />
          <input
            name="email"
            type="email"
            defaultValue={defaultValues.email}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </div>
        <div className="space-y-2 text-sm text-slate-700">
          <FormFieldLabel label="Site" requirement="optional" />
          <input
            name="website"
            defaultValue={defaultValues.website}
            placeholder="https://..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)_140px]">
        <div className="space-y-2 text-sm text-slate-700">
          <FormFieldLabel label="CEP" requirement="optional" />
          <input
            name="zip_code"
            defaultValue={defaultValues.zip_code}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </div>
        <div className="space-y-2 text-sm text-slate-700">
          <FormFieldLabel label="Rua" requirement="optional" />
          <input
            name="street"
            defaultValue={defaultValues.street}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </div>
        <div className="space-y-2 text-sm text-slate-700">
          <FormFieldLabel label="Numero" requirement="optional" />
          <input
            name="number"
            defaultValue={defaultValues.number}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </div>
        <div className="space-y-2 text-sm text-slate-700">
          <FormFieldLabel label="Bairro" requirement="optional" />
          <input
            name="district"
            defaultValue={defaultValues.district}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </div>
        <div className="space-y-2 text-sm text-slate-700">
          <FormFieldLabel label="Cidade" requirement="optional" />
          <input
            name="city"
            defaultValue={defaultValues.city}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </div>
        <div className="space-y-2 text-sm text-slate-700">
          <FormFieldLabel label="Estado" requirement="optional" />
          <input
            name="state"
            maxLength={2}
            defaultValue={defaultValues.state}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 uppercase outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div>
          <h3 className="text-base font-semibold text-slate-950">
            Texto da simulação
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Configure o bloco de segurança contratual exibido no PDF da simulação.
            Cada empresa deve usar a sua própria cláusula ou condição.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm text-slate-700">
            <FormFieldLabel label="Título do bloco" requirement="optional" />
            <input
              name="simulation_guarantee_title"
              defaultValue={defaultValues.simulation_guarantee_title}
              placeholder="Ex.: Segurança contratual"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            />
          </div>
          <div className="space-y-2 text-sm text-slate-700">
            <FormFieldLabel label="Rótulo da cláusula" requirement="optional" />
            <input
              name="simulation_guarantee_clause_label"
              defaultValue={defaultValues.simulation_guarantee_clause_label}
              placeholder="Ex.: Cláusula de garantia do contrato"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            />
          </div>
        </div>

        <div className="space-y-2 text-sm text-slate-700">
          <FormFieldLabel label="Texto introdutório" requirement="optional" />
          <textarea
            name="simulation_guarantee_lead"
            defaultValue={defaultValues.simulation_guarantee_lead}
            rows={3}
            placeholder="Texto curto explicando a segurança da prestação do serviço."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </div>

        <div className="space-y-2 text-sm text-slate-700">
          <FormFieldLabel label="Texto da cláusula" requirement="optional" />
          <textarea
            name="simulation_guarantee_clause_text"
            defaultValue={defaultValues.simulation_guarantee_clause_text}
            rows={6}
            placeholder="Cole aqui a cláusula ou condição contratual que deve aparecer na simulação desta empresa."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </div>
      </section>

      {state ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            state.ok
              ? "border-teal-200 bg-teal-50 text-teal-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Salvando..." : "Salvar empresa"}
        </button>
      </div>
    </form>
  );
}
