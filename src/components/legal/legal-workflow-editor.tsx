"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createLegalWorkflowStageAction,
  deleteLegalWorkflowStageAction,
  reorderLegalWorkflowStagesAction,
  updateLegalWorkflowStageDefinitionAction,
  type LegalWorkflowActionState,
  type LegalWorkflowStagePayload,
} from "@/app/(authenticated)/juridico/workflow-actions";
import type { LegalWorkflowStageDefinition } from "@/lib/legal/workflow";

type LegalWorkflowEditorProps = {
  stages: LegalWorkflowStageDefinition[];
  schemaReady: boolean;
};

const stageColors = [
  "#0f766e",
  "#0369a1",
  "#7c3aed",
  "#b45309",
  "#be123c",
  "#475569",
  "#047857",
  "#a21caf",
];

const emptyForm: LegalWorkflowStagePayload = {
  title: "",
  shortTitle: "",
  description: "",
  color: stageColors[0],
  expectedDocuments: [],
};

function StageForm({
  initialValues,
  disabled,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialValues: LegalWorkflowStagePayload;
  disabled: boolean;
  submitLabel: string;
  onSubmit: (values: LegalWorkflowStagePayload) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initialValues);
  const [documentsText, setDocumentsText] = useState(
    initialValues.expectedDocuments.join("\n"),
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...values,
          expectedDocuments: documentsText
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
        });
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          Título da coluna
          <input
            required
            maxLength={100}
            value={values.title}
            disabled={disabled}
            onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          Nome curto
          <input
            required
            maxLength={45}
            value={values.shortTitle}
            disabled={disabled}
            onChange={(event) =>
              setValues((current) => ({ ...current, shortTitle: event.target.value }))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </label>
      </div>

      <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
        Descrição
        <textarea
          required
          rows={3}
          maxLength={500}
          value={values.description}
          disabled={disabled}
          onChange={(event) =>
            setValues((current) => ({ ...current, description: event.target.value }))
          }
          className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        />
      </label>

      <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
        Documentos esperados
        <textarea
          rows={4}
          value={documentsText}
          disabled={disabled}
          onChange={(event) => setDocumentsText(event.target.value)}
          placeholder={"Um documento por linha\nEx.: Notificacao extrajudicial"}
          className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        />
      </label>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-700">Cor de identificacao</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {stageColors.map((color) => (
            <label
              key={color}
              className={`grid h-9 w-9 cursor-pointer place-items-center rounded-lg border-2 ${
                values.color === color ? "border-slate-950" : "border-transparent"
              }`}
              style={{ backgroundColor: color }}
              title={color}
            >
              <input
                type="radio"
                name="stage-color"
                value={color}
                checked={values.color === color}
                disabled={disabled}
                onChange={() => setValues((current) => ({ ...current, color }))}
                className="sr-only"
              />
              {values.color === color ? (
                <span className="h-2.5 w-2.5 rounded-full bg-white" />
              ) : null}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {disabled ? "Salvando..." : submitLabel}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onCancel}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function LegalWorkflowEditor({
  stages,
  schemaReady,
}: LegalWorkflowEditorProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [orderedIds, setOrderedIds] = useState(stages.map((stage) => stage.id));
  const [message, setMessage] = useState<LegalWorkflowActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  const orderedStages = useMemo(
    () =>
      orderedIds
        .map((id) => stages.find((stage) => stage.id === id))
        .filter((stage): stage is LegalWorkflowStageDefinition => Boolean(stage)),
    [orderedIds, stages],
  );
  const editingStage = stages.find((stage) => stage.id === editingStageId) ?? null;

  function finish(result: LegalWorkflowActionState) {
    setMessage(result);
    if (result.ok) {
      setCreating(false);
      setEditingStageId(null);
      router.refresh();
    }
  }

  function moveStage(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= orderedIds.length) {
      return;
    }

    const nextIds = [...orderedIds];
    [nextIds[index], nextIds[nextIndex]] = [nextIds[nextIndex], nextIds[index]];
    setOrderedIds(nextIds);
    setMessage(null);

    startTransition(async () => {
      finish(await reorderLegalWorkflowStagesAction(nextIds));
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOrderedIds(stages.map((stage) => stage.id));
          setMessage(null);
          setIsOpen(true);
        }}
        className="rounded-lg border border-teal-700 bg-white px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-50"
      >
        Editar esteira
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="workflow-editor-title"
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-2xl"
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <h2 id="workflow-editor-title" className="text-xl font-semibold text-slate-950">
                  Configurar esteira jurídica
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Organize até 20 colunas. A primeira recebe automaticamente os novos clientes aprovados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </header>

            <div className="space-y-6 p-6">
              {!schemaReady ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  A configuração ainda não foi ativada no banco. Execute o arquivo{" "}
                  <strong>docs/sql/juridico-esteira-configuravel.sql</strong> no SQL Editor do Supabase.
                </div>
              ) : null}

              {message ? (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    message.ok
                      ? "border-teal-200 bg-teal-50 text-teal-800"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {message.message}
                </div>
              ) : null}

              {!creating && !editingStage ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-700">
                      {stages.length} de 20 colunas utilizadas
                    </p>
                    <button
                      type="button"
                      disabled={!schemaReady || stages.length >= 20 || isPending}
                      onClick={() => {
                        setMessage(null);
                        setCreating(true);
                      }}
                      className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Nova coluna
                    </button>
                  </div>

                  <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                    {orderedStages.map((stage, index) => (
                      <div
                        key={stage.id}
                        className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center"
                      >
                        <span
                          className="h-10 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-950">
                            {index + 1}. {stage.shortLabel}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                            {stage.description}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={index === 0 || isPending}
                            onClick={() => moveStage(index, -1)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
                          >
                            Subir
                          </button>
                          <button
                            type="button"
                            disabled={index === orderedStages.length - 1 || isPending}
                            onClick={() => moveStage(index, 1)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
                          >
                            Descer
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              setMessage(null);
                              setEditingStageId(stage.id);
                            }}
                            className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={isPending || stages.length <= 1}
                            onClick={() => {
                              const confirmed = window.confirm(
                                "Excluir esta coluna? A exclusão será bloqueada se houver clientes ativos, inativos ou em distrato. Os templates serão mantidos sem vínculo.",
                              );
                              if (!confirmed) {
                                return;
                              }

                              startTransition(async () => {
                                finish(await deleteLegalWorkflowStageAction(stage.id));
                              });
                            }}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-40"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {creating ? (
                <div>
                  <h3 className="mb-4 text-base font-semibold text-slate-950">Nova coluna</h3>
                  <StageForm
                    initialValues={emptyForm}
                    disabled={isPending}
                    submitLabel="Criar coluna"
                    onCancel={() => setCreating(false)}
                    onSubmit={(values) => {
                      startTransition(async () => {
                        finish(await createLegalWorkflowStageAction(values));
                      });
                    }}
                  />
                </div>
              ) : null}

              {editingStage ? (
                <div>
                  <h3 className="mb-4 text-base font-semibold text-slate-950">Editar coluna</h3>
                  <StageForm
                    key={editingStage.id}
                    initialValues={{
                      title: editingStage.label.replace(/^\d+\.\s*/, ""),
                      shortTitle: editingStage.shortLabel,
                      description: editingStage.description,
                      color: editingStage.color,
                      expectedDocuments: editingStage.documents,
                    }}
                    disabled={isPending}
                    submitLabel="Salvar coluna"
                    onCancel={() => setEditingStageId(null)}
                    onSubmit={(values) => {
                      startTransition(async () => {
                        finish(
                          await updateLegalWorkflowStageDefinitionAction(
                            editingStage.id,
                            values,
                          ),
                        );
                      });
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
