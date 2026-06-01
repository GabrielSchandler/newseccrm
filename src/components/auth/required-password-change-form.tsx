"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  changeRequiredPasswordAction,
  type PasswordChangeActionState,
} from "@/app/(authenticated)/alterar-senha/actions";
import { FormFieldLabel } from "@/components/form-field-label";

const initialState: PasswordChangeActionState = {
  ok: false,
  message: "",
};

export function RequiredPasswordChangeForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState(
    changeRequiredPasswordAction,
    initialState,
  );

  useEffect(() => {
    if (state.ok && state.redirectTo) {
      router.replace(state.redirectTo);
      router.refresh();
    }
  }, [router, state]);

  return (
    <form className="space-y-5" action={formAction}>
      <div className="space-y-2">
        <FormFieldLabel
          htmlFor="password"
          label="Nova senha"
          requirement="required"
        />
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          required
          minLength={6}
        />
      </div>

      <div className="space-y-2">
        <FormFieldLabel
          htmlFor="confirm_password"
          label="Confirmar nova senha"
          requirement="required"
        />
        <input
          id="confirm_password"
          name="confirm_password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          required
          minLength={6}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
          checked={showPassword}
          onChange={(event) => setShowPassword(event.target.checked)}
        />
        Mostrar senha digitada
      </label>

      {state.message ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            state.ok
              ? "border-teal-200 bg-teal-50 text-teal-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Salvando..." : "Salvar nova senha"}
      </button>
    </form>
  );
}
