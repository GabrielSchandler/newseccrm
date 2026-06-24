import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  FileSpreadsheet,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { resolveUserDisplayName } from "@/lib/users/account";
import {
  createFinanceChargebackAction,
  createFinanceSaleAction,
  createFinanceTransactionAction,
  deleteFinanceChargebackAction,
  deleteFinanceSaleAction,
  deleteFinanceTransactionAction,
  importFinanceFilesAction,
  updateFinanceChargebackAction,
  updateFinanceSaleAction,
  updateFinanceTransactionAction,
} from "./actions";
import {
  financeModalityOptions,
  financePaymentMethods,
  type FinanceAccount,
  type FinanceCategory,
  type FinanceChargeback,
  type FinanceImportBatch,
  type FinanceSale,
  type FinanceTransaction,
} from "@/types/finance";

type FinancePageProps = {
  searchParams: Promise<{
    start?: string;
    end?: string;
    success?: string;
    error?: string;
    editTransaction?: string;
    editSale?: string;
    editChargeback?: string;
  }>;
};

type CommercialUser = {
  id: string;
  full_name: string | null;
  nickname: string | null;
  username: string | null;
  role: string | null;
  business_area: string | null;
  is_active: boolean | null;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR");

const timeZone = "America/Sao_Paulo";

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: string | number | null | undefined) {
  return currencyFormatter.format(toNumber(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : "-";
}

function getSaoPauloDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? "0"),
    month: Number(parts.find((part) => part.type === "month")?.value ?? "1"),
    day: Number(parts.find((part) => part.type === "day")?.value ?? "1"),
  };
}

function toYmd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDateRanges() {
  const today = getSaoPauloDateParts();
  const todayYmd = toYmd(today.year, today.month, today.day);
  const todayDate = new Date(Date.UTC(today.year, today.month - 1, today.day));
  const weekStart = new Date(todayDate);
  const weekDay = todayDate.getUTCDay() || 7;
  weekStart.setUTCDate(todayDate.getUTCDate() - weekDay + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  const nextMonth = today.month === 12 ? 1 : today.month + 1;
  const nextMonthYear = today.month === 12 ? today.year + 1 : today.year;
  const monthEnd = new Date(Date.UTC(nextMonthYear, nextMonth - 1, 1));
  monthEnd.setUTCDate(monthEnd.getUTCDate() - 1);

  return {
    today: { start: todayYmd, end: todayYmd },
    week: {
      start: toYmd(
        weekStart.getUTCFullYear(),
        weekStart.getUTCMonth() + 1,
        weekStart.getUTCDate(),
      ),
      end: toYmd(
        weekEnd.getUTCFullYear(),
        weekEnd.getUTCMonth() + 1,
        weekEnd.getUTCDate(),
      ),
    },
    month: {
      start: toYmd(today.year, today.month, 1),
      end: toYmd(
        monthEnd.getUTCFullYear(),
        monthEnd.getUTCMonth() + 1,
        monthEnd.getUTCDate(),
      ),
    },
  };
}

function isDateInRange(value: string | null | undefined, start: string, end: string) {
  const date = value?.slice(0, 10);
  return Boolean(date && date >= start && date <= end);
}

function transactionEffectiveDate(transaction: FinanceTransaction) {
  return transaction.status === "paid" && transaction.paid_at
    ? transaction.paid_at
    : transaction.due_date;
}

function transactionAmount(transaction: FinanceTransaction) {
  return toNumber(transaction.amount_paid ?? transaction.amount_expected);
}

function summarizeRange({
  transactions,
  sales,
  chargebacks,
  start,
  end,
}: {
  transactions: FinanceTransaction[];
  sales: FinanceSale[];
  chargebacks: FinanceChargeback[];
  start: string;
  end: string;
}) {
  const rangeTransactions = transactions.filter((transaction) =>
    isDateInRange(transactionEffectiveDate(transaction), start, end),
  );
  const rangeSales = sales.filter(
    (sale) => sale.status === "confirmed" && isDateInRange(sale.sale_date, start, end),
  );
  const rangeChargebacks = chargebacks.filter(
    (chargeback) =>
      chargeback.status !== "canceled" &&
      isDateInRange(chargeback.chargeback_date, start, end),
  );
  const manualIncome = rangeTransactions
    .filter((item) => item.direction === "income" && item.status === "paid")
    .reduce((total, item) => total + transactionAmount(item), 0);
  const salesIncome = rangeSales.reduce(
    (total, item) => total + toNumber(item.goal_amount || item.gross_amount),
    0,
  );
  const paidExpense = rangeTransactions
    .filter((item) => item.direction === "expense" && item.status === "paid")
    .reduce((total, item) => total + transactionAmount(item), 0);
  const chargebackAmount = rangeChargebacks.reduce(
    (total, item) => total + toNumber(item.amount),
    0,
  );
  const pendingPayable = rangeTransactions
    .filter((item) => item.direction === "expense" && item.status !== "paid" && item.status !== "canceled")
    .reduce((total, item) => total + toNumber(item.amount_expected), 0);
  const pendingReceivable = rangeTransactions
    .filter((item) => item.direction === "income" && item.status !== "paid" && item.status !== "canceled")
    .reduce((total, item) => total + toNumber(item.amount_expected), 0);
  const income = manualIncome + salesIncome;
  const expense = paidExpense + chargebackAmount;

  return {
    income,
    expense,
    result: income - expense,
    pendingPayable,
    pendingReceivable,
    saleCount: rangeSales.length,
    transactionCount: rangeTransactions.length,
    chargebackCount: rangeChargebacks.length,
  };
}

function createAllRange(transactions: FinanceTransaction[], sales: FinanceSale[], chargebacks: FinanceChargeback[]) {
  const dates = [
    ...transactions.map(transactionEffectiveDate),
    ...sales.map((sale) => sale.sale_date),
    ...chargebacks.map((chargeback) => chargeback.chargeback_date),
  ].filter((date): date is string => Boolean(date));

  if (!dates.length) {
    const today = getDateRanges().today.start;
    return { start: today, end: today };
  }

  return {
    start: dates.sort()[0],
    end: dates.sort().at(-1) ?? dates[0],
  };
}

function normalizeRange(start: string | undefined, end: string | undefined) {
  const ranges = getDateRanges();
  const safeStart = start?.match(/^\d{4}-\d{2}-\d{2}$/) ? start : ranges.month.start;
  const safeEnd = end?.match(/^\d{4}-\d{2}-\d{2}$/) ? end : ranges.month.end;

  if (safeStart > safeEnd) {
    return {
      start: safeEnd,
      end: safeStart,
    };
  }

  return {
    start: safeStart,
    end: safeEnd,
  };
}

function StatCard({
  label,
  value,
  detail,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "success" | "warning" | "danger";
  icon: typeof WalletCards;
}) {
  const toneClasses = {
    default: "border-slate-200 bg-white",
    success: "border-emerald-200 bg-emerald-50",
    warning: "border-amber-200 bg-amber-50",
    danger: "border-red-200 bg-red-50",
  }[tone];

  return (
    <section className={`rounded-lg border p-5 shadow-sm ${toneClasses}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-600">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <span className="rounded-lg bg-white/80 p-2 text-teal-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-5 text-slate-600">{detail}</p>
    </section>
  );
}

function MessageBox({
  type,
  message,
}: {
  type: "success" | "error";
  message: string;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3">
      <span>{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={3}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
      >
        {children}
      </select>
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function DeleteButton() {
  return (
    <button
      type="submit"
      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      Remover
    </button>
  );
}

function formatFileSize(value: number | string | null | undefined) {
  const size = toNumber(value);

  if (!size) {
    return "-";
  }

  if (size >= 1024 * 1024) {
    return `${numberFormatter.format(size / 1024 / 1024)} MB`;
  }

  return `${numberFormatter.format(size / 1024)} KB`;
}

export default async function FinanceiroPage({ searchParams }: FinancePageProps) {
  const params = await searchParams;
  const { supabase, companyId, role } = await getCurrentUserContext();

  if (role !== "admin") {
    redirect("/areas");
  }

  const selectedRange = normalizeRange(params.start, params.end);
  const ranges = getDateRanges();

  const [
    categoriesResult,
    accountsResult,
    transactionsResult,
    salesResult,
    chargebacksResult,
    importsResult,
    usersResult,
  ] = await Promise.all([
    supabase
      .from("finance_categories")
      .select("id, company_id, name, kind, is_active")
      .eq("company_id", companyId)
      .order("name", { ascending: true }),
    supabase
      .from("finance_accounts")
      .select("id, company_id, name, account_type, is_active")
      .eq("company_id", companyId)
      .order("name", { ascending: true }),
    supabase
      .from("finance_transactions")
      .select("*")
      .eq("company_id", companyId)
      .order("due_date", { ascending: false })
      .limit(5000),
    supabase
      .from("finance_sales")
      .select("*")
      .eq("company_id", companyId)
      .order("sale_date", { ascending: false })
      .limit(5000),
    supabase
      .from("finance_chargebacks")
      .select("*")
      .eq("company_id", companyId)
      .order("chargeback_date", { ascending: false })
      .limit(2000),
    supabase
      .from("finance_import_batches")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("user_profiles")
      .select("id, full_name, nickname, username, role, business_area, is_active")
      .eq("company_id", companyId)
      .order("full_name", { ascending: true }),
  ]);

  const firstError = [
    categoriesResult.error,
    accountsResult.error,
    transactionsResult.error,
    salesResult.error,
    chargebacksResult.error,
    importsResult.error,
  ].find(Boolean);
  const categories = (categoriesResult.data ?? []) as FinanceCategory[];
  const accounts = (accountsResult.data ?? []) as FinanceAccount[];
  const transactions = (transactionsResult.data ?? []) as FinanceTransaction[];
  const sales = (salesResult.data ?? []) as FinanceSale[];
  const chargebacks = (chargebacksResult.data ?? []) as FinanceChargeback[];
  const imports = (importsResult.data ?? []) as FinanceImportBatch[];
  const users = ((usersResult.data ?? []) as CommercialUser[]).filter(
    (user) => user.business_area === "commercial" && user.role === "seller",
  );
  const usersById = new Map(users.map((user) => [user.id, user]));
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const allRange = createAllRange(transactions, sales, chargebacks);
  const todaySummary = summarizeRange({
    transactions,
    sales,
    chargebacks,
    start: ranges.today.start,
    end: ranges.today.end,
  });
  const weekSummary = summarizeRange({
    transactions,
    sales,
    chargebacks,
    start: ranges.week.start,
    end: ranges.week.end,
  });
  const monthSummary = summarizeRange({
    transactions,
    sales,
    chargebacks,
    start: ranges.month.start,
    end: ranges.month.end,
  });
  const selectedSummary = summarizeRange({
    transactions,
    sales,
    chargebacks,
    start: selectedRange.start,
    end: selectedRange.end,
  });
  const totalSummary = summarizeRange({
    transactions,
    sales,
    chargebacks,
    start: allRange.start,
    end: allRange.end,
  });
  const editingTransaction = transactions.find((item) => item.id === params.editTransaction);
  const editingSale = sales.find((item) => item.id === params.editSale);
  const editingChargeback = chargebacks.find((item) => item.id === params.editChargeback);

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Controle manual e importado das vendas, despesas, recebimentos e chargebacks da empresa."
      />
      <div className="space-y-6 p-6">
        {params.success ? <MessageBox type="success" message={params.success} /> : null}
        {params.error ? <MessageBox type="error" message={params.error} /> : null}
        {firstError ? (
          <MessageBox
            type="error"
            message="As tabelas do financeiro ainda nao foram encontradas. Rode o SQL docs/sql/financeiro.sql no Supabase."
          />
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-teal-700">
                Visao executiva
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Resultado por periodo
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use o periodo para auditar o caixa. O total considera todas as linhas ja cadastradas
                ou importadas para o financeiro.
              </p>
            </div>
            <form className="grid gap-3 sm:grid-cols-[160px_160px_auto_auto]">
              <input
                type="date"
                name="start"
                defaultValue={selectedRange.start}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              />
              <input
                type="date"
                name="end"
                defaultValue={selectedRange.end}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              />
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Filtrar
              </button>
              <Link
                href="/financeiro"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Mes atual
              </Link>
            </form>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon={CalendarDays}
            label="Hoje"
            value={formatCurrency(todaySummary.result)}
            detail={`${formatCurrency(todaySummary.income)} entrada | ${formatCurrency(todaySummary.expense)} saida.`}
            tone={todaySummary.result >= 0 ? "success" : "danger"}
          />
          <StatCard
            icon={CalendarDays}
            label="Semana"
            value={formatCurrency(weekSummary.result)}
            detail={`${formatDate(ranges.week.start)} a ${formatDate(ranges.week.end)}.`}
            tone={weekSummary.result >= 0 ? "success" : "danger"}
          />
          <StatCard
            icon={WalletCards}
            label="Mes"
            value={formatCurrency(monthSummary.result)}
            detail={`${monthSummary.saleCount} venda(s), ${monthSummary.chargebackCount} chargeback(s).`}
            tone={monthSummary.result >= 0 ? "success" : "danger"}
          />
          <StatCard
            icon={Landmark}
            label="Periodo selecionado"
            value={formatCurrency(selectedSummary.result)}
            detail={`${formatDate(selectedRange.start)} a ${formatDate(selectedRange.end)}.`}
            tone={selectedSummary.result >= 0 ? "success" : "danger"}
          />
          <StatCard
            icon={FileSpreadsheet}
            label="Total historico"
            value={formatCurrency(totalSummary.result)}
            detail={`${numberFormatter.format(transactions.length + sales.length + chargebacks.length)} registro(s).`}
            tone={totalSummary.result >= 0 ? "success" : "danger"}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={ArrowUpRight}
            label="Entradas do periodo"
            value={formatCurrency(selectedSummary.income)}
            detail="Vendas confirmadas e receitas pagas."
            tone="success"
          />
          <StatCard
            icon={ArrowDownRight}
            label="Saidas do periodo"
            value={formatCurrency(selectedSummary.expense)}
            detail="Despesas pagas e chargebacks nao cancelados."
            tone={selectedSummary.expense > 0 ? "warning" : "success"}
          />
          <StatCard
            icon={WalletCards}
            label="A pagar"
            value={formatCurrency(selectedSummary.pendingPayable)}
            detail="Lancamentos de despesa ainda nao pagos."
            tone={selectedSummary.pendingPayable > 0 ? "warning" : "success"}
          />
          <StatCard
            icon={Landmark}
            label="A receber"
            value={formatCurrency(selectedSummary.pendingReceivable)}
            detail="Receitas previstas ainda nao pagas."
            tone={selectedSummary.pendingReceivable > 0 ? "warning" : "success"}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <div className="space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-950">
                  {editingTransaction ? "Editar lancamento financeiro" : "Novo lancamento financeiro"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Use para despesas, receitas previstas, contas pagas e ajustes do caixa.
                </p>
              </div>
              <form
                action={
                  editingTransaction
                    ? updateFinanceTransactionAction.bind(null, editingTransaction.id)
                    : createFinanceTransactionAction
                }
                className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3"
              >
                <SelectField label="Tipo" name="direction" defaultValue={editingTransaction?.direction ?? "expense"}>
                  <option value="expense">Saida</option>
                  <option value="income">Entrada</option>
                </SelectField>
                <SelectField label="Status" name="status" defaultValue={editingTransaction?.status ?? "planned"}>
                  <option value="planned">Previsto</option>
                  <option value="paid">Pago</option>
                  <option value="overdue">Atrasado</option>
                  <option value="canceled">Cancelado</option>
                </SelectField>
                <Field label="Vencimento" name="due_date" type="date" required defaultValue={editingTransaction?.due_date} />
                <Field label="Data do pagamento" name="paid_at" type="date" defaultValue={editingTransaction?.paid_at} />
                <Field label="Descricao" name="description" required defaultValue={editingTransaction?.description} />
                <Field label="Destinatario/Origem" name="counterparty" defaultValue={editingTransaction?.counterparty} />
                <SelectField label="Categoria" name="category_id" defaultValue={editingTransaction?.category_id}>
                  <option value="">Sem categoria</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField label="Conta/Banco" name="account_id" defaultValue={editingTransaction?.account_id}>
                  <option value="">Sem conta</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField label="Forma" name="payment_method" defaultValue={editingTransaction?.payment_method}>
                  <option value="">Nao informado</option>
                  {financePaymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </SelectField>
                <Field label="Valor previsto" name="amount_expected" required placeholder="0,00" defaultValue={editingTransaction?.amount_expected} />
                <Field label="Valor pago" name="amount_paid" placeholder="0,00" defaultValue={editingTransaction?.amount_paid} />
                <TextArea label="Observacao" name="notes" defaultValue={editingTransaction?.notes} />
                <div className="flex gap-3 md:col-span-2 xl:col-span-3">
                  <SubmitButton label={editingTransaction ? "Salvar alteracoes" : "Cadastrar lancamento"} />
                  {editingTransaction ? (
                    <Link
                      href="/financeiro"
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancelar edicao
                    </Link>
                  ) : null}
                </div>
              </form>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-950">
                  {editingSale ? "Editar venda" : "Venda manual"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Use enquanto o comercial ainda nao tabula 100% correto no CRM.
                </p>
              </div>
              <form
                action={
                  editingSale
                    ? updateFinanceSaleAction.bind(null, editingSale.id)
                    : createFinanceSaleAction
                }
                className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3"
              >
                <Field label="Data da venda" name="sale_date" type="date" required defaultValue={editingSale?.sale_date} />
                <Field label="Cliente" name="client_name" required defaultValue={editingSale?.client_name} />
                <Field label="CPF" name="client_cpf" defaultValue={editingSale?.client_cpf} />
                <SelectField label="Consultor CRM" name="consultant_user_id" defaultValue={editingSale?.consultant_user_id}>
                  <option value="">Sem vinculo</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {resolveUserDisplayName(user, "Sem nome")}
                    </option>
                  ))}
                </SelectField>
                <Field label="Consultor historico" name="consultant_name" defaultValue={editingSale?.consultant_name} />
                <SelectField label="Modalidade" name="modality" defaultValue={editingSale?.modality}>
                  <option value="">Nao informado</option>
                  {financeModalityOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </SelectField>
                <SelectField label="Plataforma/Forma" name="platform" defaultValue={editingSale?.platform}>
                  <option value="">Nao informado</option>
                  {financePaymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </SelectField>
                <Field label="Parcelas" name="installment_count" defaultValue={editingSale?.installment_count} />
                <Field label="Valor contrato" name="gross_amount" placeholder="0,00" defaultValue={editingSale?.gross_amount} />
                <Field label="Meta" name="goal_amount" placeholder="0,00" defaultValue={editingSale?.goal_amount} />
                <Field label="Devedor" name="debtor_amount" placeholder="0,00" defaultValue={editingSale?.debtor_amount} />
                <Field label="Premiacao" name="award_amount" placeholder="0,00" defaultValue={editingSale?.award_amount} />
                <Field label="Laudo" name="report_amount" placeholder="0,00" defaultValue={editingSale?.report_amount} />
                <SelectField label="Status" name="status" defaultValue={editingSale?.status ?? "confirmed"}>
                  <option value="confirmed">Confirmada</option>
                  <option value="pending">Pendente</option>
                  <option value="canceled">Cancelada</option>
                </SelectField>
                <TextArea label="Observacao" name="notes" defaultValue={editingSale?.notes} />
                <div className="flex gap-3 md:col-span-2 xl:col-span-3">
                  <SubmitButton label={editingSale ? "Salvar venda" : "Cadastrar venda"} />
                  {editingSale ? (
                    <Link
                      href="/financeiro"
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancelar edicao
                    </Link>
                  ) : null}
                </div>
              </form>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-950">
                  Importar planilhas
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Aceita os modelos do financeiro atual. A planilha original nao e alterada.
                </p>
              </div>
              <form action={importFinanceFilesAction} className="space-y-4 p-5">
                <Field
                  label="Ano das datas curtas"
                  name="default_year"
                  type="number"
                  defaultValue={getSaoPauloDateParts().year}
                  required
                />
                <input
                  name="files"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  multiple
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
                />
                <SubmitButton label="Importar arquivos" />
              </form>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-950">
                  {editingChargeback ? "Editar chargeback" : "Chargeback"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Controle de estornos e cobrancas pendentes.
                </p>
              </div>
              <form
                action={
                  editingChargeback
                    ? updateFinanceChargebackAction.bind(null, editingChargeback.id)
                    : createFinanceChargebackAction
                }
                className="grid gap-4 p-5 md:grid-cols-2"
              >
                <Field label="Data" name="chargeback_date" type="date" required defaultValue={editingChargeback?.chargeback_date} />
                <Field label="Cliente" name="client_name" required defaultValue={editingChargeback?.client_name} />
                <Field label="CPF" name="client_cpf" defaultValue={editingChargeback?.client_cpf} />
                <Field label="Valor" name="amount" placeholder="0,00" defaultValue={editingChargeback?.amount} />
                <Field label="Cobrado em" name="charged_at" type="date" defaultValue={editingChargeback?.charged_at} />
                <SelectField label="Status" name="status" defaultValue={editingChargeback?.status ?? "pending"}>
                  <option value="pending">Pendente</option>
                  <option value="charged">Cobrado</option>
                  <option value="lost">Perdido</option>
                  <option value="canceled">Cancelado</option>
                </SelectField>
                <TextArea label="Observacao" name="notes" defaultValue={editingChargeback?.notes} />
                <div className="flex gap-3 md:col-span-2">
                  <SubmitButton label={editingChargeback ? "Salvar chargeback" : "Cadastrar chargeback"} />
                  {editingChargeback ? (
                    <Link
                      href="/financeiro"
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancelar
                    </Link>
                  ) : null}
                </div>
              </form>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-950">
                  Ultimas importacoes
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {imports.map((item) => (
                  <div key={item.id} className="p-5 text-sm">
                    <p className="font-semibold text-slate-950">{item.file_name}</p>
                    <p className="mt-1 text-slate-500">
                      {formatDate(item.created_at)} | {formatFileSize(item.file_size_bytes)} | {item.status}
                    </p>
                  </div>
                ))}
                {!imports.length ? (
                  <p className="p-5 text-sm text-slate-500">
                    Nenhuma importacao registrada ainda.
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">Lancamentos financeiros</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Data</th>
                  <th className="px-5 py-3 font-semibold">Descricao</th>
                  <th className="px-5 py-3 font-semibold">Tipo</th>
                  <th className="px-5 py-3 font-semibold">Categoria</th>
                  <th className="px-5 py-3 font-semibold">Conta</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Valor</th>
                  <th className="px-5 py-3 font-semibold">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.slice(0, 80).map((transaction) => (
                  <tr key={transaction.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-3">{formatDate(transactionEffectiveDate(transaction))}</td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-950">{transaction.description}</p>
                      <p className="text-xs text-slate-500">{transaction.counterparty ?? "-"}</p>
                    </td>
                    <td className="px-5 py-3">{transaction.direction === "income" ? "Entrada" : "Saida"}</td>
                    <td className="px-5 py-3">{categoriesById.get(transaction.category_id ?? "")?.name ?? "-"}</td>
                    <td className="px-5 py-3">{accountsById.get(transaction.account_id ?? "")?.name ?? "-"}</td>
                    <td className="px-5 py-3">{transaction.status}</td>
                    <td className="px-5 py-3 font-semibold">{formatCurrency(transactionAmount(transaction))}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/financeiro?editTransaction=${transaction.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          Editar
                        </Link>
                        <form action={deleteFinanceTransactionAction.bind(null, transaction.id)}>
                          <DeleteButton />
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {!transactions.length ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                      Nenhum lancamento financeiro cadastrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">Vendas no financeiro</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Data</th>
                    <th className="px-5 py-3 font-semibold">Cliente</th>
                    <th className="px-5 py-3 font-semibold">Consultor</th>
                    <th className="px-5 py-3 font-semibold">Meta</th>
                    <th className="px-5 py-3 font-semibold">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.slice(0, 60).map((sale) => (
                    <tr key={sale.id} className="transition hover:bg-slate-50">
                      <td className="px-5 py-3">{formatDate(sale.sale_date)}</td>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-950">{sale.client_name}</p>
                        <p className="text-xs text-slate-500">{sale.modality ?? "-"}</p>
                      </td>
                      <td className="px-5 py-3">
                        {resolveUserDisplayName(
                          usersById.get(sale.consultant_user_id ?? "") ?? {
                            full_name: sale.consultant_name,
                            nickname: null,
                            username: null,
                          },
                          "Sem consultor",
                        )}
                      </td>
                      <td className="px-5 py-3 font-semibold">{formatCurrency(sale.goal_amount || sale.gross_amount)}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <Link
                            href={`/financeiro?editSale=${sale.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            Editar
                          </Link>
                          <form action={deleteFinanceSaleAction.bind(null, sale.id)}>
                            <DeleteButton />
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!sales.length ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                        Nenhuma venda cadastrada.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">Chargebacks</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Data</th>
                    <th className="px-5 py-3 font-semibold">Cliente</th>
                    <th className="px-5 py-3 font-semibold">Valor</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chargebacks.slice(0, 60).map((chargeback) => (
                    <tr key={chargeback.id} className="transition hover:bg-slate-50">
                      <td className="px-5 py-3">{formatDate(chargeback.chargeback_date)}</td>
                      <td className="px-5 py-3 font-semibold text-slate-950">{chargeback.client_name}</td>
                      <td className="px-5 py-3 font-semibold">{formatCurrency(chargeback.amount)}</td>
                      <td className="px-5 py-3">{chargeback.status}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <Link
                            href={`/financeiro?editChargeback=${chargeback.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            Editar
                          </Link>
                          <form action={deleteFinanceChargebackAction.bind(null, chargeback.id)}>
                            <DeleteButton />
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!chargebacks.length ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                        Nenhum chargeback cadastrado.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
