"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  toggleCompanyUserStatusAction,
  type UserManagementActionState,
} from "@/app/(authenticated)/usuarios/actions";

type UserToggleStatusButtonProps = {
  userId: string;
  isActive: boolean;
};

export function UserToggleStatusButton({
  userId,
  isActive,
}: UserToggleStatusButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<UserManagementActionState | null>(null);

  function handleClick() {
    const confirmed = window.confirm(
      isActive
        ? "Deseja desativar este usuário?"
        : "Deseja reativar este usuário?",
    );

    if (!confirmed) {
      return;
    }

    setState(null);
    startTransition(async () => {
      const result = await toggleCompanyUserStatusAction(userId);
      setState(result);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className={`rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
          isActive
            ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
            : "border border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100"
        }`}
      >
        {isPending ? "Salvando..." : isActive ? "Desativar" : "Reativar"}
      </button>
      {state && !state.ok ? (
        <p className="max-w-xs text-xs text-red-600">{state.message}</p>
      ) : null}
    </div>
  );
}
