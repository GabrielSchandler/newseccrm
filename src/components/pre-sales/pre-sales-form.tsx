"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
import type { PreSaleActionState } from "@/app/(authenticated)/pre-vendas/actions";
import { displayCpf, displayPhone } from "@/lib/clients/formatters";
import {
  formatCpf,
  formatPhone,
  formatZipCode,
} from "@/lib/clients/masks";
import {
  preSaleDefaultValues,
  preSaleFormSchema,
  type PreSaleFormValues,
  type PreSalePayload,
} from "@/lib/pre-sales/schema";
import {
  preSaleStatuses,
  preSaleTypes,
  type ClientOption,
  type UserProfileOption,
} from "@/types/pre-sale";

type PreSalesFormProps = {
  defaultValues?: Partial<PreSaleFormValues>;
  clients: ClientOption[];
  consultants: UserProfileOption[];
  submitLabel: string;
  openingDateLabel?: string;
  onSubmitAction: (values: PreSalePayload) => Promise<PreSaleActionState>;
};

type FormSectionProps = {
  title: string;
  description: string;
  children: ReactNode;
};

type TextFieldProps = {
  name: keyof PreSaleFormValues;
  label: string;
  register: UseFormRegister<PreSaleFormValues>;
  errors: FieldErrors<PreSaleFormValues>;
  disabled: boolean;
  type?: string;
  inputMode?: "numeric" | "decimal";
  required?: boolean;
  placeholder?: string;
  className?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};

const paymentStatusOptions = [
  "previsto",
  "pago",
  "atrasado",
  "cancelado",
] as const;

function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">{children}</div>
    </section>
  );
}

function getErrorMessage(
  errors: FieldErrors<PreSaleFormValues>,
  name: keyof PreSaleFormValues,
) {
  const error = errors[name];
  return error && "message" in error ? String(error.message) : null;
}

function TextField({
  name,
  label,
  register,
  errors,
  disabled,
  type = "text",
  inputMode,
  required = false,
  placeholder,
  className = "",
  onChange,
}: TextFieldProps) {
  const message = getErrorMessage(errors, name);

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium text-slate-700" htmlFor={name}>
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <input
        id={name}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        disabled={disabled}
        {...register(name, onChange ? { onChange } : undefined)}
      />
      {message ? <p className="text-sm text-red-600">{message}</p> : null}
    </div>
  );
}

function maskCpf(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = formatCpf(event.target.value);
}

function maskPhone(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = formatPhone(event.target.value);
}

function maskZipCode(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = formatZipCode(event.target.value);
}

function formatCurrencyInputValue(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  const numeric = Number(digits) / 100;
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function handleCurrencyMask(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = formatCurrencyInputValue(event.target.value);
}

function handleIntegerMask(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = event.target.value.replace(/\D/g, "");
}

function copyClientToSnapshot(
  client: ClientOption,
  setValue: UseFormSetValue<PreSaleFormValues>,
) {
  setValue("snapshot_full_name", client.full_name, { shouldDirty: true });
  setValue("snapshot_cpf", formatCpf(client.cpf), { shouldDirty: true });
  setValue("snapshot_rg", client.rg ?? "", { shouldDirty: true });
  setValue("snapshot_birth_date", client.birth_date ?? "", { shouldDirty: true });
  setValue("snapshot_marital_status", client.marital_status ?? "", {
    shouldDirty: true,
  });
  setValue("snapshot_profession", client.profession ?? "", { shouldDirty: true });
  setValue("snapshot_email", client.email ?? "", { shouldDirty: true });
  setValue("snapshot_phone_mobile", formatPhone(client.phone_mobile), {
    shouldDirty: true,
  });
  setValue("snapshot_phone_secondary", formatPhone(client.phone_secondary), {
    shouldDirty: true,
  });
  setValue("snapshot_zip_code", formatZipCode(client.zip_code), { shouldDirty: true });
  setValue("snapshot_street", client.street ?? "", { shouldDirty: true });
  setValue("snapshot_number", client.number ?? "", { shouldDirty: true });
  setValue("snapshot_district", client.district ?? "", { shouldDirty: true });
  setValue("snapshot_city", client.city ?? "", { shouldDirty: true });
  setValue("snapshot_state", client.state ?? "", { shouldDirty: true });
}

function copySnapshotToDebtHolder(
  values: PreSaleFormValues,
  setValue: UseFormSetValue<PreSaleFormValues>,
) {
  setValue("debt_holder_full_name", values.snapshot_full_name, { shouldDirty: true });
  setValue("debt_holder_cpf", values.snapshot_cpf, { shouldDirty: true });
  setValue("debt_holder_rg", values.snapshot_rg ?? "", { shouldDirty: true });
  setValue("debt_holder_birth_date", values.snapshot_birth_date ?? "", {
    shouldDirty: true,
  });
  setValue("debt_holder_marital_status", values.snapshot_marital_status ?? "", {
    shouldDirty: true,
  });
  setValue("debt_holder_profession", values.snapshot_profession ?? "", {
    shouldDirty: true,
  });
  setValue("debt_holder_phone_mobile", values.snapshot_phone_mobile, {
    shouldDirty: true,
  });
  setValue("debt_holder_phone_secondary", values.snapshot_phone_secondary ?? "", {
    shouldDirty: true,
  });
  setValue("debt_holder_email", values.snapshot_email ?? "", { shouldDirty: true });
  setValue("debt_holder_zip_code", values.snapshot_zip_code ?? "", {
    shouldDirty: true,
  });
  setValue("debt_holder_street", values.snapshot_street ?? "", { shouldDirty: true });
  setValue("debt_holder_number", values.snapshot_number ?? "", { shouldDirty: true });
  setValue("debt_holder_district", values.snapshot_district ?? "", {
    shouldDirty: true,
  });
  setValue("debt_holder_city", values.snapshot_city ?? "", { shouldDirty: true });
  setValue("debt_holder_state", values.snapshot_state ?? "", { shouldDirty: true });
}

export function PreSalesForm({
  defaultValues,
  clients,
  consultants,
  submitLabel,
  openingDateLabel = "Sera definida ao salvar",
  onSubmitAction,
}: PreSalesFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<PreSaleFormValues, undefined, PreSalePayload>({
    resolver: zodResolver(preSaleFormSchema),
    defaultValues: {
      ...preSaleDefaultValues,
      ...defaultValues,
      payments: defaultValues?.payments ?? preSaleDefaultValues.payments,
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "payments",
  });
  const selectedPreSaleType = watch("pre_sale_type");
  const disabled = isSubmitting || isPending;

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function confirmNavigation() {
    return !isDirty || window.confirm("Existem alteracoes nao salvas. Deseja sair mesmo assim?");
  }

  function onValidSubmit(values: PreSalePayload) {
    setMessage(null);

    startTransition(async () => {
      const result = await onSubmitAction(values);

      if (!result.ok) {
        setMessage(result.message);
      }
    });
  }

  function handleClientChange(event: ChangeEvent<HTMLSelectElement>) {
    const client = clients.find((item) => item.id === event.target.value);

    if (client) {
      copyClientToSnapshot(client, setValue);
    }
  }

  function handleDebtHolderCopyChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.checked) {
      copySnapshotToDebtHolder(getValues(), setValue);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onValidSubmit)}>
      <FormSection
        title="Cabecalho da pre-venda"
        description="Identifique a operacao, origem comercial e responsavel pelo atendimento."
      >
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="client_id">
            Cliente <span className="text-red-600">*</span>
          </label>
          <select
            id="client_id"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("client_id", { onChange: handleClientChange })}
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
          <label className="text-sm font-medium text-slate-700">
            Data de abertura
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">
            {openingDateLabel}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="consultant_user_id">
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

        <TextField
          name="media"
          label="Midia"
          register={register}
          errors={errors}
          disabled={disabled}
          placeholder="Instagram, indicacao, trafego pago..."
        />

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="pre_sale_type">
            Tipo de pre-venda <span className="text-red-600">*</span>
          </label>
          <select
            id="pre_sale_type"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("pre_sale_type")}
          >
            {preSaleTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          {errors.pre_sale_type?.message ? (
            <p className="text-sm text-red-600">{errors.pre_sale_type.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="status">
            Status <span className="text-red-600">*</span>
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

        <TextField
          name="service_type"
          label="Tipo de servico"
          register={register}
          errors={errors}
          disabled={disabled}
        />
      </FormSection>

      <FormSection
        title="Contratante"
        description="Snapshot usado futuramente por contrato e ordem de servico, sem alterar o cadastro mestre do cliente."
      >
        <TextField name="snapshot_full_name" label="Nome" register={register} errors={errors} disabled={disabled} required />
        <TextField name="snapshot_cpf" label="CPF" register={register} errors={errors} disabled={disabled} required inputMode="numeric" onChange={maskCpf} />
        <TextField name="snapshot_rg" label="RG" register={register} errors={errors} disabled={disabled} />
        <TextField name="snapshot_birth_date" label="Data de nascimento" register={register} errors={errors} disabled={disabled} type="date" />
        <TextField name="snapshot_marital_status" label="Estado civil" register={register} errors={errors} disabled={disabled} />
        <TextField name="snapshot_profession" label="Profissao" register={register} errors={errors} disabled={disabled} />
        <TextField name="snapshot_email" label="Email" register={register} errors={errors} disabled={disabled} type="email" />
        <TextField name="snapshot_phone_mobile" label="Celular" register={register} errors={errors} disabled={disabled} required inputMode="numeric" onChange={maskPhone} />
        <TextField name="snapshot_phone_secondary" label="Telefone secundario" register={register} errors={errors} disabled={disabled} inputMode="numeric" onChange={maskPhone} />
        <TextField name="snapshot_zip_code" label="CEP" register={register} errors={errors} disabled={disabled} inputMode="numeric" onChange={maskZipCode} />
        <TextField name="snapshot_street" label="Rua" register={register} errors={errors} disabled={disabled} />
        <TextField name="snapshot_number" label="Numero" register={register} errors={errors} disabled={disabled} />
        <TextField name="snapshot_district" label="Bairro" register={register} errors={errors} disabled={disabled} />
        <TextField name="snapshot_city" label="Cidade" register={register} errors={errors} disabled={disabled} />
        <TextField name="snapshot_state" label="Estado" register={register} errors={errors} disabled={disabled} />
      </FormSection>

      <FormSection
        title="Titular da divida"
        description="Use quando o financiado tiver dados diferentes do contratante."
      >
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 md:col-span-2">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
            disabled={disabled}
            onChange={handleDebtHolderCopyChange}
          />
          <span>
            Cliente e o titular da divida
            <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
              Ao marcar, os dados do contratante sao copiados para este bloco e podem
              ser ajustados manualmente depois.
            </span>
          </span>
        </label>
        <TextField name="debt_holder_full_name" label="Nome" register={register} errors={errors} disabled={disabled} />
        <TextField name="debt_holder_cpf" label="CPF" register={register} errors={errors} disabled={disabled} inputMode="numeric" onChange={maskCpf} />
        <TextField name="debt_holder_rg" label="RG" register={register} errors={errors} disabled={disabled} />
        <TextField name="debt_holder_birth_date" label="Data de nascimento" register={register} errors={errors} disabled={disabled} type="date" />
        <TextField name="debt_holder_marital_status" label="Estado civil" register={register} errors={errors} disabled={disabled} />
        <TextField name="debt_holder_profession" label="Profissao" register={register} errors={errors} disabled={disabled} />
        <TextField name="debt_holder_nationality" label="Nacionalidade" register={register} errors={errors} disabled={disabled} />
        <TextField name="debt_holder_issuer_agency" label="Orgao emissor" register={register} errors={errors} disabled={disabled} />
        <TextField name="debt_holder_father_name" label="Pai" register={register} errors={errors} disabled={disabled} />
        <TextField name="debt_holder_mother_name" label="Mae" register={register} errors={errors} disabled={disabled} />
        <TextField name="debt_holder_phone_mobile" label="Celular" register={register} errors={errors} disabled={disabled} inputMode="numeric" onChange={maskPhone} />
        <TextField name="debt_holder_phone_secondary" label="Telefone secundario" register={register} errors={errors} disabled={disabled} inputMode="numeric" onChange={maskPhone} />
        <TextField name="debt_holder_email" label="Email" register={register} errors={errors} disabled={disabled} type="email" />
        <TextField name="debt_holder_zip_code" label="CEP" register={register} errors={errors} disabled={disabled} inputMode="numeric" onChange={maskZipCode} />
        <TextField name="debt_holder_street" label="Rua" register={register} errors={errors} disabled={disabled} />
        <TextField name="debt_holder_number" label="Numero" register={register} errors={errors} disabled={disabled} />
        <TextField name="debt_holder_district" label="Bairro" register={register} errors={errors} disabled={disabled} />
        <TextField name="debt_holder_city" label="Cidade" register={register} errors={errors} disabled={disabled} />
        <TextField name="debt_holder_state" label="Estado" register={register} errors={errors} disabled={disabled} />
      </FormSection>

      <FormSection
        title="Dados financeiros"
        description="Dados da operacao, financiamento e contrato existente."
      >
        <TextField name="financer_name" label="Financeira" register={register} errors={errors} disabled={disabled} />
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="has_financing_contract">
            Possui contrato de financiamento?
          </label>
          <select
            id="has_financing_contract"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("has_financing_contract")}
          >
            <option value="">Nao informado</option>
            <option value="true">Sim</option>
            <option value="false">Nao</option>
          </select>
        </div>
        <TextField name="financed_amount" label="Valor da operacao / financiado" register={register} errors={errors} disabled={disabled} inputMode="decimal" placeholder="0,00" onChange={handleCurrencyMask} />
        <TextField name="installment_amount" label="Valor da parcela" register={register} errors={errors} disabled={disabled} inputMode="decimal" placeholder="0,00" onChange={handleCurrencyMask} />
        <TextField name="paid_installments" label="Parcelas pagas" register={register} errors={errors} disabled={disabled} inputMode="numeric" onChange={handleIntegerMask} />
        <TextField name="overdue_installments" label="Parcelas em atraso" register={register} errors={errors} disabled={disabled} inputMode="numeric" onChange={handleIntegerMask} />
        <TextField name="due_day" label="Dia do vencimento" register={register} errors={errors} disabled={disabled} inputMode="numeric" onChange={handleIntegerMask} />
        <TextField name="contract_number" label="Numero do contrato" register={register} errors={errors} disabled={disabled} />
      </FormSection>

      {selectedPreSaleType === "veiculo" ? (
        <FormSection
          title="Dados do veiculo"
          description="Campos obrigatorios somente para operacoes de veiculo."
        >
          <TextField name="asset_brand_model" label="Veiculo / marca-modelo" register={register} errors={errors} disabled={disabled} required />
          <TextField name="asset_color" label="Cor" register={register} errors={errors} disabled={disabled} required />
          <TextField name="asset_year" label="Ano" register={register} errors={errors} disabled={disabled} required inputMode="numeric" onChange={handleIntegerMask} />
          <TextField name="asset_plate" label="Placa" register={register} errors={errors} disabled={disabled} required />
        </FormSection>
      ) : null}

      <FormSection
        title="Contratacao e negociacao"
        description="Registre valores, detalhes combinados e observacoes operacionais."
      >
        <TextField name="contract_value" label="Valor do contrato" register={register} errors={errors} disabled={disabled} inputMode="decimal" placeholder="0,00" onChange={handleCurrencyMask} />
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="negotiation_details">
            Descricao livre da contratacao / informe
          </label>
          <textarea
            id="negotiation_details"
            rows={6}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("negotiation_details")}
          />
          {errors.negotiation_details?.message ? (
            <p className="text-sm text-red-600">
              {errors.negotiation_details.message}
            </p>
          ) : null}
        </div>
      </FormSection>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Pagamentos previstos
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Inclua parcelas previstas para acompanhamento comercial inicial.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            disabled={disabled}
            onClick={() =>
              append({
                installment_number: String(fields.length + 1),
                amount: "",
                payment_method: "",
                payment_date: "",
                status: "previsto",
              })
            }
          >
            Adicionar pagamento
          </button>
        </div>
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[90px_1fr_1fr_1fr_1fr_auto]"
            >
              <input
                aria-label="Numero da parcela"
                inputMode="numeric"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                disabled={disabled}
                placeholder="Parcela"
                {...register(`payments.${index}.installment_number`, {
                  onChange: handleIntegerMask,
                })}
              />
              <input
                aria-label="Valor"
                inputMode="decimal"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                disabled={disabled}
                placeholder="Valor"
                {...register(`payments.${index}.amount`, {
                  onChange: handleCurrencyMask,
                })}
              />
              <input
                aria-label="Forma"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                disabled={disabled}
                placeholder="Forma"
                {...register(`payments.${index}.payment_method`)}
              />
              <input
                aria-label="Data"
                type="date"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                disabled={disabled}
                {...register(`payments.${index}.payment_date`)}
              />
              <select
                aria-label="Status"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                disabled={disabled}
                {...register(`payments.${index}.status`)}
              >
                {paymentStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                disabled={disabled}
                onClick={() => remove(index)}
              >
                Remover
              </button>
            </div>
          ))}
          {errors.payments?.message ? (
            <p className="text-sm text-red-600">{String(errors.payments.message)}</p>
          ) : null}
        </div>
      </section>

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
          onClick={() => {
            if (confirmNavigation()) {
              router.back();
            }
          }}
        >
          Voltar
        </button>
        <Link
          href="/pre-vendas"
          onClick={(event) => {
            if (!confirmNavigation()) {
              event.preventDefault();
            }
          }}
          className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
        >
          Lista de pre-vendas
        </Link>
      </div>
    </form>
  );
}
