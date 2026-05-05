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
