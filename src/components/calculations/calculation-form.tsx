"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FocusEvent } from "react";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { CalculationActionState } from "@/app/(authenticated)/calculos/actions";
import {
  formatCurrencyInputValueFromDigits,
  formatNumberForPtBrInput,
  normalizeCurrencyInputValue,
  parseBrazilianDecimalInput,
} from "@/lib/calculations/currency";
import { formatCpf, formatPhone, onlyDigits } from "@/lib/clients/masks";
import { FormFieldLabel } from "@/components/form-field-label";
import {
  financingCalculationDefaultValues,
  financingCalculationFormSchema,
  type FinancingCalculationFormValues,
  type FinancingCalculationPayload,
} from "@/lib/calculations/schema";
import type {
  CalculationClientOption,
  CalculationPreSaleOption,
} from "@/types/calculation";

type BaseFormProps = {
  submitLabel: string;
  clients: CalculationClientOption[];
  preSales: CalculationPreSaleOption[];
};

type CreateFormProps = BaseFormProps & {
  mode: "create";
  onSubmitAction: (
    values: FinancingCalculationPayload,
  ) => Promise<CalculationActionState>;
  defaultValues?: FinancingCalculationFormValues;
};

type EditFormProps = BaseFormProps & {
  mode: "edit";
  onSubmitAction: (
    values: FinancingCalculationPayload,
  ) => Promise<CalculationActionState>;
  defaultValues: FinancingCalculationFormValues;
};

type CalculationFormProps = CreateFormProps | EditFormProps;

function handleCurrencyMask(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = formatCurrencyInputValueFromDigits(event.target.value);
}

function handleIntegerMask(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = event.target.value.replace(/\D/g, "");
}

function handleCurrencyBlur(event: FocusEvent<HTMLInputElement>) {
  event.target.value = normalizeCurrencyInputValue(event.target.value);
}

function CalculationActionMessage({
  state,
}: {
  state: CalculationActionState | null;
}) {
  if (!state) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        state.ok
          ? "border-teal-200 bg-teal-50 text-teal-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {state.message}
    </div>
  );
}

export function CalculationForm({
  submitLabel,
  onSubmitAction,
  clients,
  preSales,
  defaultValues,
}: CalculationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionState, setActionState] = useState<CalculationActionState | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<
    FinancingCalculationFormValues,
    undefined,
    FinancingCalculationPayload
  >({
    resolver: zodResolver(financingCalculationFormSchema),
    defaultValues: defaultValues ?? financingCalculationDefaultValues,
  });
  const selectedPreSaleId = watch("pre_sale_id");
  const cashValue = watch("cash_value");
  const downPayment = watch("down_payment");
  const installmentCount = watch("installment_count");
  const paidInstallments = watch("paid_installments");
  const financedValue = watch("financed_value");
  const remainingInstallments = watch("remaining_installments");
  const disabled = isPending || isSubmitting;
  const selectedPreSale = preSales.find((preSale) => preSale.id === selectedPreSaleId);

  useEffect(() => {
    const nextFinancedValue = Math.max(
      (parseBrazilianDecimalInput(cashValue ?? "") ?? 0) -
        (parseBrazilianDecimalInput(downPayment ?? "") ?? 0),
      0,
    );
    const formatted = formatNumberForPtBrInput(nextFinancedValue);

    if ((financedValue ?? "") !== formatted) {
      setValue("financed_value", formatted, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [cashValue, downPayment, financedValue, setValue]);

  useEffect(() => {
    const totalInstallments = Number(String(installmentCount ?? "").replace(/\D/g, "")) || 0;
    const paid = Number(String(paidInstallments ?? "").replace(/\D/g, "")) || 0;
    const nextRemainingInstallments = Math.max(totalInstallments - paid, 0);
    const formatted = nextRemainingInstallments ? String(nextRemainingInstallments) : "";

    if ((remainingInstallments ?? "") !== formatted) {
      setValue("remaining_installments", formatted, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [installmentCount, paidInstallments, remainingInstallments, setValue]);

  function applyClientSelection(clientId: string) {
    const client = clients.find((item) => item.id === clientId);

    if (!client) {
      return;
    }

    setValue("client_id", client.id, { shouldDirty: true });
    setValue("client_name", client.full_name, { shouldDirty: true });
    setValue("client_cpf", formatCpf(client.cpf), { shouldDirty: true });
    setValue("client_phone", formatPhone(client.phone_mobile), {
      shouldDirty: true,
    });
  }

  function applyPreSaleSelection(preSaleId: string) {
    const preSale = preSales.find((item) => item.id === preSaleId);

    if (!preSale) {
      return;
    }

    setValue("pre_sale_id", preSale.id, { shouldDirty: true });
    setValue("client_id", preSale.client_id, { shouldDirty: true });
    setValue("client_name", preSale.client_name, { shouldDirty: true });
    setValue("client_cpf", formatCpf(preSale.client_cpf), { shouldDirty: true });
    setValue("client_phone", formatPhone(preSale.client_phone ?? ""), {
      shouldDirty: true,
    });
    setValue("financial_institution", preSale.financial_institution ?? "", {
      shouldDirty: true,
    });
    setValue("specialist_name", preSale.specialist_name ?? "", {
      shouldDirty: true,
    });
    setValue("vehicle_year", preSale.vehicle_year ?? "", { shouldDirty: true });
    setValue(
      "financed_value",
      preSale.financed_value === null
        ? ""
        : formatNumberForPtBrInput(preSale.financed_value),
      { shouldDirty: true },
    );
    setValue(
      "down_payment",
      preSale.down_payment === null
        ? ""
        : formatNumberForPtBrInput(preSale.down_payment),
      { shouldDirty: true },
    );
    setValue(
      "current_installment_value",
      preSale.current_installment_value === null
        ? ""
        : formatNumberForPtBrInput(preSale.current_installment_value),
      { shouldDirty: true },
    );
    setValue(
      "paid_installments",
      preSale.paid_installments === null ? "" : String(preSale.paid_installments),
      { shouldDirty: true },
    );
    setValue(
      "remaining_installments",
      preSale.remaining_installments === null
        ? ""
        : String(preSale.remaining_installments),
      { shouldDirty: true },
    );
  }

  function onValidSubmit(values: FinancingCalculationPayload) {
    setActionState(null);

    startTransition(async () => {
      const result = await onSubmitAction(values);
      setActionState(result);

      if (result.ok && result.redirectTo) {
        router.push(result.redirectTo);
        router.refresh();
      }
    });
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit(onValidSubmit)}>
      <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <div className="space-y-2">
          <FormFieldLabel
            htmlFor="client_id"
            label="Cliente vinculado"
            requirement="optional"
          />
          <select
            id="client_id"
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            {...register("client_id")}
            onChange={(event) => {
              register("client_id").onChange(event);
              if (event.target.value) {
                applyClientSelection(event.target.value);
              }
            }}
          >
            <option value="">Nao vincular agora</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name}
              </option>
            ))}
          </select>
          {errors.client_id?.message ? (
            <p className="text-sm text-red-600">{String(errors.client_id.message)}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <FormFieldLabel
            htmlFor="pre_sale_id"
            label="Pre-venda vinculada"
            requirement="optional"
          />
          <select
            id="pre_sale_id"
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            {...register("pre_sale_id")}
            onChange={(event) => {
              register("pre_sale_id").onChange(event);
              if (event.target.value) {
                applyPreSaleSelection(event.target.value);
              }
            }}
          >
            <option value="">Nao vincular agora</option>
            {preSales.map((preSale) => (
              <option key={preSale.id} value={preSale.id}>
                {preSale.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            Ao selecionar uma pre-venda, o sistema preenche cliente, financeira e
            dados do financiamento automaticamente.
          </p>
          {errors.pre_sale_id?.message ? (
            <p className="text-sm text-red-600">{String(errors.pre_sale_id.message)}</p>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Dados do cliente</h2>
          <p className="mt-1 text-sm text-slate-600">
            Voce pode manter os dados vinculados ao cadastro ou ajustar manualmente.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="client_name"
              label="Nome do cliente"
              requirement="optional"
              hint="Se nao informar, o documento e a simulacao exibem Nao informado."
            />
            <input
              id="client_name"
              disabled={disabled}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              {...register("client_name")}
            />
            {errors.client_name?.message ? (
              <p className="text-sm text-red-600">{String(errors.client_name.message)}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="client_cpf"
              label="CPF"
              requirement="optional"
              hint="Se nao informar, o documento e a simulacao exibem Nao informado."
            />
            <input
              id="client_cpf"
              disabled={disabled}
              maxLength={14}
              inputMode="numeric"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              {...register("client_cpf", {
                onChange: (event) => {
                  event.target.value = formatCpf(onlyDigits(event.target.value));
                },
              })}
            />
            {errors.client_cpf?.message ? (
              <p className="text-sm text-red-600">{String(errors.client_cpf.message)}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <FormFieldLabel htmlFor="client_phone" label="Telefone" requirement="optional" />
            <input
              id="client_phone"
              disabled={disabled}
              maxLength={15}
              inputMode="numeric"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              {...register("client_phone", {
                onChange: (event) => {
                  event.target.value = formatPhone(event.target.value);
                },
              })}
            />
            {errors.client_phone?.message ? (
              <p className="text-sm text-red-600">{String(errors.client_phone.message)}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Dados da operacao</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="financial_institution"
              label="Financeira"
              requirement="optional"
            />
            <input
              id="financial_institution"
              disabled={disabled}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              {...register("financial_institution")}
            />
          </div>
          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="specialist_name"
              label="Especialista"
              requirement="optional"
            />
            <input
              id="specialist_name"
              disabled={disabled}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              {...register("specialist_name")}
            />
          </div>
          <div className="space-y-2">
            <FormFieldLabel htmlFor="situation" label="Situacao" requirement="optional" />
            <input
              id="situation"
              disabled={disabled}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              {...register("situation")}
            />
          </div>
          <div className="space-y-2">
            <FormFieldLabel htmlFor="expires_in" label="Expira em" requirement="optional" />
            <input
              id="expires_in"
              type="date"
              disabled={disabled}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              {...register("expires_in")}
            />
          </div>
          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="attendance_date"
              label="Data de atendimento"
              requirement="optional"
            />
            <input
              id="attendance_date"
              type="date"
              disabled={disabled}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              {...register("attendance_date")}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Dados do veiculo</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <FormFieldLabel htmlFor="vehicle_year" label="Ano" requirement="optional" />
            <input
              id="vehicle_year"
              disabled={disabled}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              {...register("vehicle_year")}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <FormFieldLabel htmlFor="notes" label="Observacoes" requirement="optional" />
            <textarea
              id="notes"
              rows={4}
              disabled={disabled}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              {...register("notes")}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Dados do financiamento
          </h2>
          {selectedPreSale ? (
            <p className="mt-1 text-sm text-teal-700">
              Dados preenchidos a partir da pre-venda vinculada. Voce ainda pode
              ajustar manualmente.
            </p>
          ) : null}
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="cash_value"
              label="Valor a vista"
              requirement="optional"
            />
            <input
              id="cash_value"
              disabled={disabled}
              inputMode="decimal"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              {...register("cash_value", {
                onChange: handleCurrencyMask,
                onBlur: handleCurrencyBlur,
              })}
            />
            {errors.cash_value?.message ? (
              <p className="text-sm text-red-600">{String(errors.cash_value.message)}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="down_payment"
              label="Entrada"
              requirement="optional"
            />
            <input
              id="down_payment"
              disabled={disabled}
              inputMode="decimal"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              {...register("down_payment", {
                onChange: handleCurrencyMask,
                onBlur: handleCurrencyBlur,
              })}
            />
            {errors.down_payment?.message ? (
              <p className="text-sm text-red-600">
                {String(errors.down_payment.message)}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="financed_value"
              label="Valor financiado"
              requirement="optional"
            />
            <input
              id="financed_value"
              disabled={disabled}
              readOnly
              inputMode="decimal"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              {...register("financed_value")}
            />
            <p className="text-xs text-slate-500">
              Calculado automaticamente: valor a vista menos entrada.
            </p>
            {errors.financed_value?.message ? (
              <p className="text-sm text-red-600">
                {String(errors.financed_value.message)}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="current_installment_value"
              label="Valor atual da parcela"
              requirement="optional"
            />
            <input
              id="current_installment_value"
              disabled={disabled}
              inputMode="decimal"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              {...register("current_installment_value", {
                onChange: handleCurrencyMask,
                onBlur: handleCurrencyBlur,
              })}
            />
            {errors.current_installment_value?.message ? (
              <p className="text-sm text-red-600">
                {String(errors.current_installment_value.message)}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="installment_count"
              label="Quantidade de parcelas"
              requirement="optional"
            />
            <input
              id="installment_count"
              disabled={disabled}
              inputMode="numeric"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              {...register("installment_count", { onChange: handleIntegerMask })}
            />
            {errors.installment_count?.message ? (
              <p className="text-sm text-red-600">
                {String(errors.installment_count.message)}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="paid_installments"
              label="Parcelas pagas"
              requirement="optional"
            />
            <input
              id="paid_installments"
              disabled={disabled}
              inputMode="numeric"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              {...register("paid_installments", { onChange: handleIntegerMask })}
            />
            {errors.paid_installments?.message ? (
              <p className="text-sm text-red-600">
                {String(errors.paid_installments.message)}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="remaining_installments"
              label="Parcelas a pagar"
              requirement="optional"
            />
            <input
              id="remaining_installments"
              disabled={disabled}
              readOnly
              inputMode="numeric"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              {...register("remaining_installments", { onChange: handleIntegerMask })}
            />
            <p className="text-xs text-slate-500">
              Calculado automaticamente: total de parcelas menos parcelas pagas.
            </p>
            {errors.remaining_installments?.message ? (
              <p className="text-sm text-red-600">
                {String(errors.remaining_installments.message)}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <CalculationActionMessage state={actionState} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {disabled ? "Salvando simulacao..." : submitLabel}
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          onClick={() => router.back()}
        >
          Voltar
        </button>
        <Link
          href="/calculos"
          className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
        >
          Lista de simulacoes
        </Link>
      </div>
    </form>
  );
}
