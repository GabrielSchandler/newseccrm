"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import {
  clientDefaultValues,
  clientFormSchema,
  type ClientFormValues,
  type ClientPayload,
} from "@/lib/clients/schema";
import { formatCpf, formatPhone, formatZipCode, onlyDigits } from "@/lib/clients/masks";
import { ReactivateClientButton } from "./reactivate-client-button";
import type { ClientActionState } from "@/app/(authenticated)/clientes/actions";

type ClientFormProps = {
  defaultValues?: Partial<ClientFormValues>;
  submitLabel: string;
  onSubmitAction: (values: ClientPayload) => Promise<ClientActionState>;
  canReactivateDeletedClient?: boolean;
};

const fields = [
  { name: "full_name", label: "Nome completo", type: "text", required: true },
  { name: "cpf", label: "CPF", type: "text", required: true },
  { name: "phone_mobile", label: "Celular", type: "text", required: true },
  { name: "rg", label: "RG", type: "text" },
  { name: "birth_date", label: "Data de nascimento", type: "date" },
  { name: "marital_status", label: "Estado civil", type: "select" },
  { name: "profession", label: "Profissao", type: "text" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone_secondary", label: "Telefone secundario", type: "text" },
  { name: "zip_code", label: "CEP", type: "text" },
  { name: "street", label: "Rua", type: "text" },
  { name: "number", label: "Numero", type: "text" },
  { name: "district", label: "Bairro", type: "text" },
  { name: "city", label: "Cidade", type: "text" },
  { name: "state", label: "Estado", type: "text" },
] as const;

const maritalStatusOptions = [
  "Solteiro",
  "Casado",
  "Divorciado",
  "Viuvo",
  "Uniao estavel",
] as const;

function maskValue(fieldName: string, value: string) {
  if (fieldName === "cpf") {
    return formatCpf(value);
  }

  if (fieldName === "phone_mobile" || fieldName === "phone_secondary") {
    return formatPhone(value);
  }

  if (fieldName === "zip_code") {
    return formatZipCode(value);
  }

  return value;
}

function getMaxLength(fieldName: string) {
  if (fieldName === "cpf") {
    return 14;
  }

  if (fieldName === "phone_mobile" || fieldName === "phone_secondary") {
    return 15;
  }

  if (fieldName === "zip_code") {
    return 9;
  }

  return undefined;
}

export function ClientForm({
  defaultValues,
  submitLabel,
  onSubmitAction,
  canReactivateDeletedClient = false,
}: ClientFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionState, setActionState] = useState<ClientActionState | null>(null);
  const [lastFetchedZipCode, setLastFetchedZipCode] = useState<string | null>(() =>
    onlyDigits(typeof defaultValues?.zip_code === "string" ? defaultValues.zip_code : ""),
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ClientFormValues, undefined, ClientPayload>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      ...clientDefaultValues,
      ...defaultValues,
    },
  });

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

  const zipCodeValue = watch("zip_code");

  function confirmNavigation() {
    return !isDirty || window.confirm("Existem alteracoes nao salvas. Deseja sair mesmo assim?");
  }

  const fetchAddressByZipCode = useCallback(async (zipCode: string) => {
    if (zipCode.length !== 8 || zipCode === lastFetchedZipCode) {
      return;
    }

    try {
      setLastFetchedZipCode(zipCode);
      const response = await fetch(`https://viacep.com.br/ws/${zipCode}/json/`);
      const data = (await response.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };

      if (data.erro) {
        setLastFetchedZipCode(null);
        return;
      }

      setValue("street", data.logradouro ?? "", { shouldDirty: true });
      setValue("district", data.bairro ?? "", { shouldDirty: true });
      setValue("city", data.localidade ?? "", { shouldDirty: true });
      setValue("state", data.uf ?? "", { shouldDirty: true });
    } catch {
      setLastFetchedZipCode(null);
      // CEP lookup is a convenience; manual address entry remains available.
    }
  }, [lastFetchedZipCode, setValue]);

  useEffect(() => {
    const zipCode = onlyDigits(typeof zipCodeValue === "string" ? zipCodeValue : "");

    if (zipCode.length === 8) {
      void fetchAddressByZipCode(zipCode);
    }
  }, [fetchAddressByZipCode, zipCodeValue]);

  function onValidSubmit(values: ClientPayload) {
    setActionState(null);

    startTransition(async () => {
      const result = await onSubmitAction(values);

      if (!result.ok) {
        setActionState(result);
      }
    });
  }

  const disabled = isSubmitting || isPending;

  return (
    <form className="space-y-8" onSubmit={handleSubmit(onValidSubmit)}>
      <div className="grid gap-5 md:grid-cols-2">
        {fields.map((field) => (
          <div className="space-y-2" key={field.name}>
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor={field.name}
            >
              {field.label}
              {"required" in field && field.required ? (
                <span className="text-red-600"> *</span>
              ) : null}
            </label>
            {field.type === "select" ? (
              <select
                id={field.name}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                disabled={disabled}
                {...register(field.name)}
              >
                <option value="">Selecione</option>
                {maritalStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={field.name}
                type={field.type}
                inputMode={
                  field.name === "cpf" ||
                  field.name === "phone_mobile" ||
                  field.name === "phone_secondary" ||
                  field.name === "zip_code"
                    ? "numeric"
                    : undefined
                }
                maxLength={getMaxLength(field.name)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                disabled={disabled}
                {...register(field.name, {
                  onChange(event: ChangeEvent<HTMLInputElement>) {
                    event.target.value = maskValue(field.name, event.target.value);

                  },
                })}
              />
            )}
            {errors[field.name]?.message ? (
              <p className="text-sm text-red-600">
                {String(errors[field.name]?.message)}
              </p>
            ) : null}
          </div>
        ))}

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="notes">
            Observacoes
          </label>
          <textarea
            id="notes"
            rows={5}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("notes")}
          />
        </div>
      </div>

      {actionState ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{actionState.message}</p>
          {actionState.deletedClientId ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/clientes/${actionState.deletedClientId}`}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
              >
                Ver cliente
              </Link>
              {canReactivateDeletedClient ? (
                <ReactivateClientButton clientId={actionState.deletedClientId} />
              ) : null}
            </div>
          ) : null}
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
          href="/clientes"
          onClick={(event) => {
            if (!confirmNavigation()) {
              event.preventDefault();
            }
          }}
          className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
        >
          Lista de clientes
        </Link>
      </div>
    </form>
  );
}
