import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          CRM SaaS
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Acesse sua conta
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Entre com seu login da empresa para acessar o painel.
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
