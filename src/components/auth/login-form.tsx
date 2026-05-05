"use client";

import { Eye, LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { signInWithLoginAction, type LoginActionState } from "@/app/actions/auth";
import { FormFieldLabel } from "@/components/form-field-label";

const initialState: LoginActionState = {
  ok: false,
  message: "",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState(
    signInWithLoginAction,
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
      <input
        type="hidden"
        name="redirectedFrom"
        value={searchParams.get("redirectedFrom") ?? "/"}
      />
      <div className="space-y-2">
        <FormFieldLabel htmlFor="login" label="Login" requirement="required" />
        <input
          id="login"
          name="login"
          type="text"
          autoComplete="username"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          placeholder="nome.sobrenome"
          autoCapitalize="none"
          autoCorrect="off"
          required
        />
        <p className="text-xs text-slate-500">
          Durante a transicao, o acesso antigo por email tambem continua funcionando.
        </p>
      </div>

      <div className="space-y-2">
        <FormFieldLabel htmlFor="password" label="Senha" requirement="required" />
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-11 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            placeholder="Digite sua senha"
            required
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!state.ok && state.message ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <LogIn className="h-4 w-4" />
        {isPending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
