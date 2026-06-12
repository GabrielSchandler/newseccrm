"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { UserManagementActionState } from "@/app/(authenticated)/usuarios/actions";
import { FormFieldLabel } from "@/components/form-field-label";
import {
  formatCurrencyInputValueFromDigits,
  normalizeCurrencyInputValue,
} from "@/lib/calculations/currency";
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
import {
  companyBusinessAreas,
  companyUserRoles,
  legalUserRoles,
  type CompanyUserProfile,
} from "@/types/user";

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
  canManagePasswords: boolean;
  canViewCurrentPassword: boolean;
};

type UserFormProps =
  | ({ mode: "create" } & CreateUserFormProps)
  | ({ mode: "edit" } & EditUserFormProps & { canViewCurrentPassword: boolean });

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

function handleCurrencyMask(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = formatCurrencyInputValueFromDigits(event.target.value);
}

function handleCurrencyBlur(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = normalizeCurrencyInputValue(event.target.value);
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
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateCompanyUserFormValues, undefined, CreateCompanyUserPayload>({
    resolver: zodResolver(createCompanyUserSchema),
    defaultValues: createCompanyUserDefaultValues,
  });
  const disabled = isPending || isSubmitting;
  const businessArea = watch("business_area");
  const userRole = watch("role");
  const shouldShowMonthlyGoal = businessArea === "commercial" && userRole === "seller";

  useEffect(() => {
    if (!shouldShowMonthlyGoal) {
      setValue("monthly_goal", "", { shouldDirty: true });
    }
  }, [setValue, shouldShowMonthlyGoal]);

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
          <FormFieldLabel
            htmlFor="full_name"
            label="Nome completo"
            requirement="required"
          />
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
          <FormFieldLabel htmlFor="nickname" label="Apelido" requirement="optional" />
          <input
            id="nickname"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            placeholder="Nome que vai aparecer na simulacao"
            {...register("nickname")}
          />
          <p className="text-xs text-slate-500">
            Se informado, este nome aparece no PDF da simulacao no lugar do nome completo.
          </p>
          {errors.nickname?.message ? (
            <p className="text-sm text-red-600">{String(errors.nickname.message)}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <FormFieldLabel htmlFor="phone" label="Telefone" requirement="optional" />
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
          <FormFieldLabel
            htmlFor="username"
            label="Login"
            requirement="required"
          />
          <input
            id="username"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            placeholder="nome.sobrenome"
            autoCapitalize="none"
            autoCorrect="off"
            {...register("username")}
          />
          <p className="text-xs text-slate-500">
            Este sera o login usado no acesso ao CRM.
          </p>
          {errors.username?.message ? (
            <p className="text-sm text-red-600">{String(errors.username.message)}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <FormFieldLabel
            htmlFor="temporary_password"
            label="Senha provisoria"
            requirement="required"
          />
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
          <FormFieldLabel
            htmlFor="business_area"
            label="Area principal"
            requirement="required"
          />
          <select
            id="business_area"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("business_area")}
          >
            {companyBusinessAreas.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            Para consultores, isso define se o acesso vai direto para Comercial ou Juridico.
          </p>
          {errors.business_area?.message ? (
            <p className="text-sm text-red-600">{String(errors.business_area.message)}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <FormFieldLabel htmlFor="role" label="Cargo" requirement="required" />
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

        {businessArea === "legal" ? (
          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="legal_role"
              label="Funcao no juridico"
              requirement="required"
            />
            <select
              id="legal_role"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              disabled={disabled}
              {...register("legal_role")}
            >
              {legalUserRoles.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Adms aparecem no campo Adm responsavel. Consultores aparecem no campo Consultor responsavel.
            </p>
            {errors.legal_role?.message ? (
              <p className="text-sm text-red-600">{String(errors.legal_role.message)}</p>
            ) : null}
          </div>
        ) : null}

        {shouldShowMonthlyGoal ? (
          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="monthly_goal"
              label="Meta do mes"
              requirement="optional"
            />
            <div className="flex rounded-lg border border-slate-300 bg-white focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/15">
              <span className="flex items-center border-r border-slate-200 px-3 text-sm font-semibold text-slate-500">
                R$
              </span>
              <input
                id="monthly_goal"
                inputMode="decimal"
                className="min-w-0 flex-1 rounded-r-lg bg-transparent px-3 py-2.5 text-sm outline-none"
                disabled={disabled}
                placeholder="0,00"
                {...register("monthly_goal", {
                  onBlur: handleCurrencyBlur,
                  onChange: handleCurrencyMask,
                })}
              />
            </div>
            <p className="text-xs text-slate-500">
              Usado para acompanhar a meta mensal do consultor comercial.
            </p>
            {errors.monthly_goal?.message ? (
              <p className="text-sm text-red-600">
                {String(errors.monthly_goal.message)}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 md:col-span-2">
          O sistema cria e gerencia automaticamente um email interno para o Supabase
          Auth. No uso diario do CRM, o acesso e feito pelo login acima.
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
  canManagePasswords,
  canViewCurrentPassword,
}: EditUserFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionState, setActionState] = useState<UserManagementActionState | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const roleOptions = availableRoles(canAssignAdmin);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UpdateCompanyUserFormValues, undefined, UpdateCompanyUserPayload>({
    resolver: zodResolver(updateCompanyUserSchema),
    defaultValues: companyUserToFormValues(defaultValues),
  });
  const disabled = isPending || isSubmitting;
  const businessArea = watch("business_area");
  const userRole = watch("role");
  const shouldShowMonthlyGoal = businessArea === "commercial" && userRole === "seller";

  useEffect(() => {
    if (!shouldShowMonthlyGoal) {
      setValue("monthly_goal", "", { shouldDirty: true });
    }
  }, [setValue, shouldShowMonthlyGoal]);

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
          <FormFieldLabel
            htmlFor="full_name"
            label="Nome completo"
            requirement="required"
          />
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
          <FormFieldLabel htmlFor="nickname" label="Apelido" requirement="optional" />
          <input
            id="nickname"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            placeholder="Nome que vai aparecer na simulacao"
            {...register("nickname")}
          />
          <p className="text-xs text-slate-500">
            Se informado, este nome aparece no PDF da simulacao no lugar do nome completo.
          </p>
          {errors.nickname?.message ? (
            <p className="text-sm text-red-600">{String(errors.nickname.message)}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <FormFieldLabel htmlFor="phone" label="Telefone" requirement="optional" />
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
          <FormFieldLabel
            htmlFor="username"
            label="Login"
            requirement="required"
          />
          <input
            id="username"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            autoCapitalize="none"
            autoCorrect="off"
            {...register("username")}
          />
          <p className="text-xs text-slate-500">
            Este login substitui o uso de email na entrada do CRM.
          </p>
          {errors.username?.message ? (
            <p className="text-sm text-red-600">{String(errors.username.message)}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <FormFieldLabel
            htmlFor="business_area"
            label="Area principal"
            requirement="required"
          />
          <select
            id="business_area"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("business_area")}
          >
            {companyBusinessAreas.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            Admins e gerentes podem trocar de area na entrada do CRM. Para consultores, isso define o modulo inicial.
          </p>
          {errors.business_area?.message ? (
            <p className="text-sm text-red-600">{String(errors.business_area.message)}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <FormFieldLabel htmlFor="role" label="Cargo" requirement="required" />
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

        {businessArea === "legal" ? (
          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="legal_role"
              label="Funcao no juridico"
              requirement="required"
            />
            <select
              id="legal_role"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              disabled={disabled}
              {...register("legal_role")}
            >
              {legalUserRoles.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Adms aparecem no campo Adm responsavel. Consultores aparecem no campo Consultor responsavel.
            </p>
            {errors.legal_role?.message ? (
              <p className="text-sm text-red-600">{String(errors.legal_role.message)}</p>
            ) : null}
          </div>
        ) : null}

        {shouldShowMonthlyGoal ? (
          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="monthly_goal"
              label="Meta do mes"
              requirement="optional"
            />
            <div className="flex rounded-lg border border-slate-300 bg-white focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/15">
              <span className="flex items-center border-r border-slate-200 px-3 text-sm font-semibold text-slate-500">
                R$
              </span>
              <input
                id="monthly_goal"
                inputMode="decimal"
                className="min-w-0 flex-1 rounded-r-lg bg-transparent px-3 py-2.5 text-sm outline-none"
                disabled={disabled}
                placeholder="0,00"
                {...register("monthly_goal", {
                  onBlur: handleCurrencyBlur,
                  onChange: handleCurrencyMask,
                })}
              />
            </div>
            <p className="text-xs text-slate-500">
              Usado para acompanhar a meta mensal do consultor comercial.
            </p>
            {errors.monthly_goal?.message ? (
              <p className="text-sm text-red-600">
                {String(errors.monthly_goal.message)}
              </p>
            ) : null}
          </div>
        ) : null}

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

      {canViewCurrentPassword && defaultValues.last_set_password ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-blue-900">
            Senha provisoria atual
          </h2>
          <p className="mt-1 text-sm leading-6 text-blue-700">
            Esta e a ultima senha provisoria definida para este usuario. Sera apagada automaticamente quando o usuario criar uma senha definitiva.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              type={showCurrentPassword ? "text" : "password"}
              readOnly
              value={defaultValues.last_set_password}
              className="min-w-0 flex-1 rounded-lg border border-blue-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword((v) => !v)}
              className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-100"
            >
              {showCurrentPassword ? "Ocultar" : "Ver"}
            </button>
          </div>
        </div>
      ) : null}

      {canManagePasswords ? (
        <div className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
          <div className="md:col-span-2">
            <h2 className="text-base font-semibold text-slate-950">
              Senha de acesso
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Defina uma nova senha provisoria abaixo. O administrador pode
              exigir que o usuario troque no proximo acesso.
            </p>
          </div>

          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="new_password"
              label="Nova senha provisoria"
              requirement="optional"
            />
            <div className="flex gap-2">
              <input
                id="new_password"
                type={showNewPassword ? "text" : "password"}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                disabled={disabled}
                autoComplete="new-password"
                {...register("new_password")}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => setShowNewPassword((current) => !current)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {showNewPassword ? "Ocultar" : "Ver"}
              </button>
            </div>
            {errors.new_password?.message ? (
              <p className="text-sm text-red-600">
                {String(errors.new_password.message)}
              </p>
            ) : null}
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-amber-300 text-teal-700 focus:ring-teal-600"
              disabled={disabled}
              {...register("force_password_change")}
            />
            <span>
              Exigir troca no proximo login
              <span className="mt-1 block text-xs font-normal leading-5 text-amber-800">
                Com esta opcao marcada, o usuario entra com a senha provisoria
                e e direcionado para criar uma senha definitiva.
              </span>
            </span>
          </label>
        </div>
      ) : null}

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
      canManagePasswords={props.canManagePasswords}
      canViewCurrentPassword={props.canViewCurrentPassword}
    />
  );
}
