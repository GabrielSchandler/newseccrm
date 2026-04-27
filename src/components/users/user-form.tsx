"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { UserManagementActionState } from "@/app/(authenticated)/usuarios/actions";
import { formatPhone } from "@/lib/clients/masks";
import {
  companyUserToFormValues,
  createCompanyUserDefaultValues,
  createCompanyUserSchema,
  updateCompanyUserSchema,
  type CreateCompanyUserFormValues,
  type CreateCompanyUserPayload,
  type UpdateCompanyUserFormValues,
  type UpdateCompanyUserPayload,
} from "@/lib/users/schema";
import { companyUserRoles, type CompanyUserProfile } from "@/types/user";

type CreateUserFormProps = {
  submitLabel: string;
  onSubmitAction: (values: CreateCompanyUserPayload) => Promise<UserManagementActionState>;
  canAssignAdmin: boolean;
};

type EditUserFormProps = {
  defaultValues: CompanyUserProfile;
  submitLabel: string;
  onSubmitAction: (values: UpdateCompanyUserPayload) => Promise<UserManagementActionState>;
  canAssignAdmin: boolean;
};

type UserFormProps =
  | ({ mode: "create" } & CreateUserFormProps)
  | ({ mode: "edit" } & EditUserFormProps);

function availableRoles(canAssignAdmin: boolean) {
  return companyUserRoles.filter((item) => canAssignAdmin || item.value !== "admin");
}

function UserFormFooter({
  disabled,
  submitLabel,
}: {
  disabled: boolean;
  submitLabel: string;
}) {
  const router = useRouter();

  return (
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
        href="/usuarios"
        className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
      >
        Lista de usuarios
      </Link>
    </div>
  );
}

function UserActionMessage({ state }: { state: UserManagementActionState | null }) {
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

function handlePhoneMask(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = formatPhone(event.target.value);
}

function CreateUserForm({
  submitLabel,
  onSubmitAction,
  canAssignAdmin,
}: CreateUserFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionState, setActionState] = useState<UserManagementActionState | null>(null);
  const roleOptions = availableRoles(canAssignAdmin);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateCompanyUserFormValues, undefined, CreateCompanyUserPayload>({
    resolver: zodResolver(createCompanyUserSchema),
    defaultValues: createCompanyUserDefaultValues,
  });
  const disabled = isPending || isSubmitting;

  function onValidSubmit(values: CreateCompanyUserPayload) {
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
      <div className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="full_name">
            Nome completo <span className="text-red-600">*</span>
          </label>
          <input
            id="full_name"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("full_name")}
          />
          {errors.full_name?.message ? (
            <p className="text-sm text-red-600">{String(errors.full_name.message)}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="phone">
            Telefone
          </label>
          <input
            id="phone"
            inputMode="numeric"
            maxLength={15}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("phone", { onChange: handlePhoneMask })}
          />
          {errors.phone?.message ? (
            <p className="text-sm text-red-600">{String(errors.phone.message)}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="email">
            Email <span className="text-red-600">*</span>
          </label>
          <input
            id="email"
            type="email"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("email")}
          />
          {errors.email?.message ? (
            <p className="text-sm text-red-600">{String(errors.email.message)}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor="temporary_password"
          >
            Senha provisoria <span className="text-red-600">*</span>
          </label>
          <input
            id="temporary_password"
            type="password"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("temporary_password")}
          />
          {errors.temporary_password?.message ? (
            <p className="text-sm text-red-600">
              {String(errors.temporary_password.message)}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="role">
            Cargo <span className="text-red-600">*</span>
          </label>
          <select
            id="role"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("role")}
          >
            {roleOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {errors.role?.message ? (
            <p className="text-sm text-red-600">{String(errors.role.message)}</p>
          ) : null}
        </div>
      </div>

      <UserActionMessage state={actionState} />
      <UserFormFooter disabled={disabled} submitLabel={submitLabel} />
    </form>
  );
}

function EditUserForm({
  defaultValues,
  submitLabel,
  onSubmitAction,
  canAssignAdmin,
}: EditUserFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionState, setActionState] = useState<UserManagementActionState | null>(null);
  const roleOptions = availableRoles(canAssignAdmin);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateCompanyUserFormValues, undefined, UpdateCompanyUserPayload>({
    resolver: zodResolver(updateCompanyUserSchema),
    defaultValues: companyUserToFormValues(defaultValues),
  });
  const disabled = isPending || isSubmitting;

  function onValidSubmit(values: UpdateCompanyUserPayload) {
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
      <div className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="full_name">
            Nome completo <span className="text-red-600">*</span>
          </label>
          <input
            id="full_name"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("full_name")}
          />
          {errors.full_name?.message ? (
            <p className="text-sm text-red-600">{String(errors.full_name.message)}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="phone">
            Telefone
          </label>
          <input
            id="phone"
            inputMode="numeric"
            maxLength={15}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("phone", { onChange: handlePhoneMask })}
          />
          {errors.phone?.message ? (
            <p className="text-sm text-red-600">{String(errors.phone.message)}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="role">
            Cargo <span className="text-red-600">*</span>
          </label>
          <select
            id="role"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("role")}
          >
            {roleOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {errors.role?.message ? (
            <p className="text-sm text-red-600">{String(errors.role.message)}</p>
          ) : null}
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
            disabled={disabled}
            {...register("is_active")}
          />
          <span>
            Usuario ativo
            <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
              Desative para bloquear o acesso sem apagar o historico do usuario.
            </span>
          </span>
        </label>
      </div>

      <UserActionMessage state={actionState} />
      <UserFormFooter disabled={disabled} submitLabel={submitLabel} />
    </form>
  );
}

export function UserForm(props: UserFormProps) {
  if (props.mode === "create") {
    return (
      <CreateUserForm
        submitLabel={props.submitLabel}
        onSubmitAction={props.onSubmitAction}
        canAssignAdmin={props.canAssignAdmin}
      />
    );
  }

  return (
    <EditUserForm
      defaultValues={props.defaultValues}
      submitLabel={props.submitLabel}
      onSubmitAction={props.onSubmitAction}
      canAssignAdmin={props.canAssignAdmin}
    />
  );
}
