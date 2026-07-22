import Link from "next/link";
import {
  createLegalPaymentAction,
  deleteLegalPaymentAction,
  generateLegalPaymentReceiptAction,
  updateLegalPaymentAction,
} from "@/app/(authenticated)/juridico/pagamentos/actions";
import { formatCurrency, formatUserName } from "@/lib/pre-sales/formatters";
import type { DocumentTemplate, GeneratedDocument } from "@/types/document";
import { financePaymentMethods } from "@/types/finance";
import {
  legalPaymentStatuses,
  type LegalPayment,
  type LegalPaymentType,
} from "@/types/legal-payment";
import type { UserProfileOption } from "@/types/pre-sale";

type LegalPaymentWithRelations = LegalPayment & {
  type: LegalPaymentType | null;
  responsible: UserProfileOption | null;
  receiptDocument?: GeneratedDocument | null;
};

type LegalPaymentsPanelProps = {
  preSaleId: string;
  legalPayments: LegalPaymentWithRelations[];
  legalPaymentTypes: LegalPaymentType[];
  legalUsers: UserProfileOption[];
  templates: DocumentTemplate[];
  canManage: boolean;
  successMessage?: string | null;
  errorMessage?: string | null;
};

const statusTone: Record<string, string> = {
  previsto: "border-amber-200 bg-amber-50 text-amber-800",
  pago: "border-emerald-200 bg-emerald-50 text-emerald-800",
  vencido: "border-red-200 bg-red-50 text-red-800",
  cancelado: "border-slate-200 bg-slate-50 text-slate-600",
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : "-";
}

function toInputDate(value: string | null | undefined) {
  return value?.slice(0, 10) ?? "";
}

function statusLabel(status: string) {
  return legalPaymentStatuses.find((item) => item.value === status)?.label ?? status;
}

function templateLooksLikeReceipt(template: DocumentTemplate) {
  const normalized = `${template.name} ${template.description ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return (
    normalized.includes("recibo") ||
    normalized.includes("pagamento") ||
    normalized.includes("termo")
  );
}

function PaymentFields({
  legalPaymentTypes,
  legalUsers,
  defaultPayment,
}: {
  legalPaymentTypes: LegalPaymentType[];
  legalUsers: UserProfileOption[];
  defaultPayment?: LegalPaymentWithRelations;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <label className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Tipo de cobrança
        </span>
        <select
          name="legal_payment_type_id"
          defaultValue={defaultPayment?.legal_payment_type_id ?? ""}
          required
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        >
          <option value="">Selecione</option>
          {legalPaymentTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Responsável jurídico
        </span>
        <select
          name="responsible_user_id"
          defaultValue={defaultPayment?.responsible_user_id ?? ""}
          required
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        >
          <option value="">Selecione</option>
          {legalUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {formatUserName(user)}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Parcela
        </span>
        <input
          type="number"
          min="1"
          name="installment_number"
          defaultValue={String(defaultPayment?.installment_number ?? 1)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        />
      </label>

      <label className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Valor cobrado
        </span>
        <input
          name="amount"
          inputMode="decimal"
          defaultValue={defaultPayment?.amount ? String(defaultPayment.amount).replace(".", ",") : ""}
          placeholder="0,00"
          required
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        />
      </label>

      <label className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Valor meta
        </span>
        <input
          name="goal_amount"
          inputMode="decimal"
          defaultValue={defaultPayment?.goal_amount ? String(defaultPayment.goal_amount).replace(".", ",") : ""}
          placeholder="Usa o valor cobrado se ficar vazio"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        />
      </label>

      <label className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Forma
        </span>
        <select
          name="payment_method"
          defaultValue={defaultPayment?.payment_method ?? ""}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        >
          <option value="">Não informado</option>
          {financePaymentMethods.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Status
        </span>
        <select
          name="status"
          defaultValue={defaultPayment?.status ?? "previsto"}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        >
          {legalPaymentStatuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Vencimento
        </span>
        <input
          type="date"
          name="due_date"
          defaultValue={toInputDate(defaultPayment?.due_date)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        />
      </label>

      <label className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Data de pagamento
        </span>
        <input
          type="date"
          name="paid_at"
          defaultValue={toInputDate(defaultPayment?.paid_at)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        />
      </label>

      <label className="space-y-1.5 md:col-span-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Descrição
        </span>
        <input
          name="description"
          defaultValue={defaultPayment?.description ?? ""}
          placeholder="Ex.: Pagamento de laudo pericial"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        />
      </label>

      <label className="space-y-1.5 md:col-span-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Observações internas
        </span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaultPayment?.notes ?? ""}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        />
      </label>
    </div>
  );
}

export function LegalPaymentsPanel({
  preSaleId,
  legalPayments,
  legalPaymentTypes,
  legalUsers,
  templates,
  canManage,
  successMessage,
  errorMessage,
}: LegalPaymentsPanelProps) {
  const receiptTemplates = templates.filter(templateLooksLikeReceipt);
  const availableReceiptTemplates = receiptTemplates.length ? receiptTemplates : templates;

  return (
    <section
      id="pagamentos-juridicos"
      className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            Jurídico
          </p>
          <h2 className="mt-1 text-base font-semibold text-slate-950">
            Pagamentos jurídicos
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Lance laudo, diligencia, certidao, honorarios, acordo e outras cobranças vinculadas a este protocolo.
          </p>
        </div>
        <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
          {legalPayments.length} lançamento(s)
        </span>
      </div>

      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      ) : null}

      {canManage ? (
        <details className="rounded-lg border border-teal-200 bg-teal-50/40 p-4" open={!legalPayments.length}>
          <summary className="cursor-pointer text-sm font-semibold text-slate-950">
            Novo pagamento jurídico
          </summary>
          <form action={createLegalPaymentAction.bind(null, preSaleId)} className="mt-4 space-y-4">
            <PaymentFields legalPaymentTypes={legalPaymentTypes} legalUsers={legalUsers} />
            <button
              type="submit"
              className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              Cadastrar pagamento jurídico
            </button>
          </form>
        </details>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Somente usuários jurídicos, gestores e administradores podem lançar pagamentos jurídicos.
        </div>
      )}

      <div className="space-y-4">
        {legalPayments.map((payment) => (
          <article
            key={payment.id}
            className="rounded-lg border border-slate-200 bg-slate-50/60 p-4"
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-950">
                    {payment.type?.name ?? "Cobrança jurídica"}
                  </h3>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      statusTone[payment.status] ?? statusTone.previsto
                    }`}
                  >
                    {statusLabel(payment.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Responsável:{" "}
                  <span className="font-semibold text-slate-900">
                    {formatUserName(payment.responsible)}
                  </span>
                </p>
                {payment.description ? (
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {payment.description}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-4 xl:min-w-[560px]">
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Valor</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {formatCurrency(payment.amount)}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Meta</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {formatCurrency(payment.goal_amount)}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Vencimento</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {formatDate(payment.due_date)}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Pago em</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {formatDate(payment.paid_at)}
                  </p>
                </div>
              </div>
            </div>

            {payment.notes ? (
              <p className="mt-3 whitespace-pre-line rounded-lg bg-white p-3 text-sm text-slate-600">
                {payment.notes}
              </p>
            ) : null}

            {payment.receiptDocument ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Recibo gerado:{" "}
                <Link
                  href="/documentos"
                  className="font-semibold underline decoration-emerald-500 underline-offset-4"
                >
                  {payment.receiptDocument.title}
                </Link>
              </div>
            ) : null}

            {canManage ? (
              <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
                <details className="rounded-lg border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-950">
                    Editar pagamento
                  </summary>
                  <form
                    action={updateLegalPaymentAction.bind(null, payment.id)}
                    className="mt-4 space-y-4"
                  >
                    <input type="hidden" name="pre_sale_id" value={preSaleId} />
                    <PaymentFields
                      legalPaymentTypes={legalPaymentTypes}
                      legalUsers={legalUsers}
                      defaultPayment={payment}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
                      >
                        Salvar pagamento
                      </button>
                    </div>
                  </form>
                </details>

                <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                  <form
                    action={generateLegalPaymentReceiptAction.bind(null, payment.id)}
                    className="space-y-3"
                  >
                    <input type="hidden" name="pre_sale_id" value={preSaleId} />
                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Recibo/documento
                      </span>
                      <select
                        name="template_id"
                        defaultValue=""
                        disabled={payment.status !== "pago"}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        <option value="">Selecione o template</option>
                        {availableReceiptTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="submit"
                      disabled={payment.status !== "pago"}
                      className="w-full rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      Gerar recibo jurídico
                    </button>
                  </form>

                  <form action={deleteLegalPaymentAction.bind(null, payment.id)}>
                    <input type="hidden" name="pre_sale_id" value={preSaleId} />
                    <button
                      type="submit"
                      className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                    >
                      Remover pagamento
                    </button>
                  </form>
                </div>
              </div>
            ) : null}
          </article>
        ))}

        {!legalPayments.length ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            Nenhum pagamento jurídico cadastrado para este protocolo.
          </div>
        ) : null}
      </div>
    </section>
  );
}
