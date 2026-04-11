"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import {
  preSaleDefaultValues,
  preSaleFormSchema,
  type PreSaleFormValues,
  type PreSalePayload,
} from "@/lib/pre-sales/schema";
import { preSaleStatuses, type ClientOption, type UserProfileOption } from "@/types/pre-sale";
import type { PreSaleActionState } from "@/app/(authenticated)/pre-vendas/actions";
import { displayCpf, displayPhone } from "@/lib/clients/formatters";

type PreSalesFormProps = {
  defaultValues?: Partial<PreSaleFormValues>;
  clients: ClientOption[];
  consultants: UserProfileOption[];
  submitLabel: string;
  onSubmitAction: (values: PreSalePayload) => Promise<PreSaleActionState>;
};

export function PreSalesForm({
  defaultValues,
  clients,
  consultants,
  submitLabel,
  onSubmitAction,
}: PreSalesFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PreSaleFormValues, undefined, PreSalePayload>({
    resolver: zodResolver(preSaleFormSchema),
    defaultValues: {
      ...preSaleDefaultValues,
      ...defaultValues,
    },
  });

  function onValidSubmit(values: PreSalePayload) {
    setMessage(null);

    startTransition(async () => {
      const result = await onSubmitAction(values);

      if (!result.ok) {
        setMessage(result.message);
      }
    });
  }

  const disabled = isSubmitting || isPending;

  return (
    <form className="space-y-8" onSubmit={handleSubmit(onValidSubmit)}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="client_id">
            Cliente <span className="text-red-600">*</span>
          </label>
          <select
            id="client_id"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("client_id")}
          >
            <option value="">Selecione um cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name} - {displayCpf(client.cpf)} -{" "}
                {displayPhone(client.phone_mobile)}
              </option>
            ))}
          </select>
          {errors.client_id?.message ? (
            <p className="text-sm text-red-600">{errors.client_id.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor="consultant_user_id"
          >
            Consultor
          </label>
          <select
            id="consultant_user_id"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("consultant_user_id")}
          >
            <option value="">Sem consultor</option>
            {consultants.map((consultant) => (
              <option key={consultant.id} value={consultant.id}>
                {consultant.full_name || consultant.email}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("status")}
          >
            {preSaleStatuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="service_type">
            Tipo de servico
          </label>
          <input
            id="service_type"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("service_type")}
          />
        </div>

        <div className="space-y-2">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor="estimated_contract_value"
          >
            Valor estimado
          </label>
          <input
            id="estimated_contract_value"
            inputMode="decimal"
            placeholder="0,00"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("estimated_contract_value")}
          />
          {errors.estimated_contract_value?.message ? (
            <p className="text-sm text-red-600">
              {errors.estimated_contract_value.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor="negotiation_notes"
          >
            Observacoes da negociacao
          </label>
          <textarea
            id="negotiation_notes"
            rows={5}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("negotiation_notes")}
          />
        </div>
      </div>

      {message ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {disabled ? "Salvando..." : submitLabel}
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          onClick={() => router.back()}
        >
          Voltar
        </button>
        <Link
          href="/pre-vendas"
          className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
        >
          Lista de pre-vendas
        </Link>
      </div>
    </form>
  );
}
