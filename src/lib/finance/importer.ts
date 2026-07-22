import { createHash } from "node:crypto";
import * as XLSX from "xlsx";

export type ParsedFinanceTransaction = {
  direction: "income" | "expense";
  status: "planned" | "paid" | "overdue" | "canceled";
  due_date: string;
  paid_at: string | null;
  description: string;
  counterparty: string | null;
  amount_expected: number;
  amount_paid: number | null;
  payment_method: string | null;
  source_hash: string;
  notes: string | null;
  sheet_name: string;
  row_number: number;
  raw_data: Record<string, unknown>;
};

export type ParsedFinanceSale = {
  sale_date: string;
  client_name: string;
  client_cpf: string | null;
  consultant_name: string | null;
  modality: string | null;
  platform: string | null;
  installment_count: string | null;
  gross_amount: number;
  goal_amount: number;
  debtor_amount: number | null;
  award_amount: number | null;
  report_amount: number | null;
  status: "confirmed" | "pending" | "canceled";
  source_hash: string;
  notes: string | null;
  sheet_name: string;
  row_number: number;
  raw_data: Record<string, unknown>;
};

export type ParsedFinanceChargeback = {
  chargeback_date: string;
  client_name: string;
  client_cpf: string | null;
  amount: number;
  charged_at: string | null;
  status: "pending" | "charged" | "lost" | "canceled";
  source_hash: string;
  notes: string | null;
  sheet_name: string;
  row_number: number;
  raw_data: Record<string, unknown>;
};

export type ParsedFinanceImport = {
  transactions: ParsedFinanceTransaction[];
  sales: ParsedFinanceSale[];
  chargebacks: ParsedFinanceChargeback[];
  ignoredRows: Array<{
    sheet_name: string;
    row_number: number;
    reason: string;
    raw_data: Record<string, unknown>;
  }>;
  summary: {
    sheets: number;
    transactions: number;
    sales: number;
    chargebacks: number;
    ignoredRows: number;
  };
};

const defaultDate = "1900-01-01";
const metadataRowNumberKey = "__finance_import_row_number";

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function normalizeCpf(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 11 ? digits.slice(-11) : null;
}

function parseMoney(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = String(value ?? "").trim();

  if (!text) {
    return 0;
  }

  const clean = text
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  let normalized = clean;

  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastDot > lastComma
        ? clean.replace(/,/g, "")
        : clean.replace(/\./g, "").replace(",", ".");
  } else if (lastComma >= 0) {
    normalized = clean.replace(/\./g, "").replace(",", ".");
  } else if (lastDot >= 0 && !/\.\d{1,2}$/.test(clean)) {
    normalized = clean.replace(/\./g, "");
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: unknown, defaultYear = new Date().getFullYear()) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  const brDate = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);

  if (brDate) {
    const year = Number(brDate[3].length === 2 ? `20${brDate[3]}` : brDate[3]);
    const month = Number(brDate[2]);
    const day = Number(brDate[1]);

    if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  }

  const shortDate = text.match(/^(\d{1,2})[-/ ]([a-zA-ZçÇ]{3,9})$/);

  if (shortDate) {
    const monthKey = normalizeText(shortDate[2]).slice(0, 3);
    const monthByName: Record<string, number> = {
      JAN: 1,
      FEV: 2,
      FEB: 2,
      MAR: 3,
      ABR: 4,
      APR: 4,
      MAI: 5,
      MAY: 5,
      JUN: 6,
      JUL: 7,
      AGO: 8,
      AUG: 8,
      SET: 9,
      SEP: 9,
      OUT: 10,
      OCT: 10,
      NOV: 11,
      DEZ: 12,
      DEC: 12,
    };
    const month = monthByName[monthKey];
    const day = Number(shortDate[1]);

    if (month && day >= 1 && day <= 31) {
      return `${defaultYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

function rowGetter(row: Record<string, unknown>) {
  const entries = Object.entries(row).map(([key, value]) => ({
    key,
    normalizedKey: normalizeText(key),
    value,
  }));

  return (...keys: string[]) => {
    const normalizedKeys = keys.map(normalizeText);
    const match = entries.find((entry) =>
      normalizedKeys.includes(entry.normalizedKey),
    );

    return match?.value ?? null;
  };
}

function hasHeader(headers: Set<string>, ...keys: string[]) {
  return keys.some((key) => headers.has(normalizeText(key)));
}

function makeSourceHash(
  fileName: string,
  sheetName: string,
  rowNumber: number,
  rowType: string,
  row: Record<string, unknown>,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        fileName,
        sheetName,
        rowNumber,
        rowType,
        row,
      }),
    )
    .digest("hex");
}

function makeUniqueHeader(header: unknown, index: number, seen: Map<string, number>) {
  const base = cleanText(header) ?? `EMPTY ${index}`;
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);

  return count > 0 ? `${base} ${count}` : base;
}

function findHeaderRowIndex(matrix: unknown[][]) {
  const keywords = new Set([
    "VCTO",
    "DECRICAO",
    "DESCRIÇÃO",
    "DESTINATARIO",
    "DESTINATARIO",
    "CONTAS A PAGAR",
    "CONTAS PAGAS",
    "GASTOS EXTRAS",
    "DATA PGTO",
    "NOME CLIENTE",
    "NOME DO CLIENTE",
    "CLIENTE",
    "CPF",
    "META",
    "CONTRATO",
    "VENDA",
    "VALOR",
    "COBRADO",
  ]);

  return matrix.findIndex((row) => {
    const normalizedCells = row.map(normalizeText);
    const hits = normalizedCells.filter((cell) => keywords.has(cell)).length;

    return hits >= 2;
  });
}

function getSheetRows(workbook: XLSX.WorkBook, sheetName: string) {
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    return [];
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    defval: null,
    header: 1,
    raw: false,
    blankrows: false,
  });
  const headerRowIndex = findHeaderRowIndex(matrix);

  if (headerRowIndex < 0) {
    return [];
  }

  const seen = new Map<string, number>();
  const headers = matrix[headerRowIndex].map((header, index) =>
    makeUniqueHeader(header, index, seen),
  );

  return matrix.slice(headerRowIndex + 1).map((row, index) => {
    const output: Record<string, unknown> = {};

    headers.forEach((header, cellIndex) => {
      output[header] = row[cellIndex] ?? null;
    });

    output[metadataRowNumberKey] = headerRowIndex + index + 2;
    return output;
  });
}

function parseTransactionRows(
  fileName: string,
  sheetName: string,
  rows: Record<string, unknown>[],
  defaultYear: number,
): ParsedFinanceTransaction[] {
  const transactions: ParsedFinanceTransaction[] = [];

  rows.forEach((row, index) => {
    const get = rowGetter(row);
    const rowNumber = Number(row[metadataRowNumberKey] ?? index + 2);
    const description =
      cleanText(get("DECRICAO", "DESCRIÇÃO", "DESCRIÇÃO", "HISTÓRICO")) ??
      cleanText(get("DESTINATARIO", "DESTINATÁRIO")) ??
      "Lancamento importado";
    const dueDate = parseDate(get("VCTO", "VENCIMENTO", "DATA"), defaultYear) ?? defaultDate;
    const paidAt = parseDate(get("DATA PGTO", "DATA PAGAMENTO", "PGTO"), defaultYear);
    const amountExpected = parseMoney(get("CONTAS A PAGAR", "A PAGAR", "VALOR"));
    const paidAmount = parseMoney(get("CONTAS PAGAS", "PAGO", "VALOR PAGO"));
    const extraAmount = parseMoney(get("GASTOS EXTRAS", "GASTO EXTRA"));
    const paymentMethod = cleanText(get("FORMA DE PAGAMENTO", "FORMA PGTO", "FORMA"));
    const bank = cleanText(get("BANCO", "CONTA"));
    const notes = cleanText(get("OBSERVACAO", "OBSERVAÇÃO", "OBS"));

    if (amountExpected > 0 || paidAmount > 0) {
      transactions.push({
        direction: "expense",
        status: paidAt || paidAmount > 0 ? "paid" : "planned",
        due_date: dueDate,
        paid_at: paidAt,
        description,
        counterparty: cleanText(get("DESTINATARIO", "DESTINATÁRIO")),
        amount_expected: amountExpected || paidAmount,
        amount_paid: paidAmount > 0 ? paidAmount : null,
        payment_method: paymentMethod ?? bank,
        source_hash: makeSourceHash(fileName, sheetName, rowNumber, "transaction", row),
        notes,
        sheet_name: sheetName,
        row_number: rowNumber,
        raw_data: row,
      });
    }

    if (extraAmount > 0) {
      transactions.push({
        direction: "expense",
        status: "paid",
        due_date: paidAt ?? dueDate,
        paid_at: paidAt ?? dueDate,
        description: `${description} - gasto extra`,
        counterparty: cleanText(get("DESTINATARIO", "DESTINATÁRIO")),
        amount_expected: extraAmount,
        amount_paid: extraAmount,
        payment_method: paymentMethod ?? bank,
        source_hash: makeSourceHash(fileName, sheetName, rowNumber, "extra", row),
        notes,
        sheet_name: sheetName,
        row_number: rowNumber,
        raw_data: row,
      });
    }
  });

  return transactions;
}

function parseSaleRows(
  fileName: string,
  sheetName: string,
  rows: Record<string, unknown>[],
  defaultYear: number,
): ParsedFinanceSale[] {
  const sales: ParsedFinanceSale[] = [];
  const sheetConsultant = normalizeText(sheetName).includes("CLIENTE")
    ? null
    : cleanText(sheetName);

  rows.forEach((row, index) => {
    const get = rowGetter(row);
    const rowNumber = Number(row[metadataRowNumberKey] ?? index + 2);
    const clientName = cleanText(get("NOME CLIENTE", "CLIENTE", "NOME DO CLIENTE"));
    const goalAmount = parseMoney(get("META"));
    const grossAmount = parseMoney(get("CONTRATO", "VENDA", "VALOR", "VALOR CONTRATO"));

    if (!clientName || (goalAmount <= 0 && grossAmount <= 0)) {
      return;
    }

    sales.push({
      sale_date: parseDate(get("DATA", "DATA DA ABERTURA", "CONTRATO"), defaultYear) ?? defaultDate,
      client_name: clientName,
      client_cpf: normalizeCpf(get("CPF")),
      consultant_name:
        cleanText(get("CONSULTOR", "COMERCIAL", "COMERCAL")) ?? sheetConsultant,
      modality: cleanText(get("MODALIDADE", "TIPO", "SERVIÇO", "SERVIÇO")),
      platform: cleanText(get("PLATAFORMA", "FORMA", "PGTO", "PAGAMENTO")),
      installment_count: cleanText(get("QTDE", "PARCELA", "PARCELAS")),
      gross_amount: grossAmount || goalAmount,
      goal_amount: goalAmount || grossAmount,
      debtor_amount: parseMoney(get("DEVEDOR")) || null,
      award_amount: parseMoney(get("PREMIACAO", "PREMIAÇÃO")) || null,
      report_amount: parseMoney(get("LAUDO")) || null,
      status: "confirmed",
      source_hash: makeSourceHash(fileName, sheetName, rowNumber, "sale", row),
      notes: cleanText(get("OBSERVACAO", "OBSERVAÇÃO", "OBS")),
      sheet_name: sheetName,
      row_number: rowNumber,
      raw_data: row,
    });
  });

  return sales;
}

function parseChargebackRows(
  fileName: string,
  sheetName: string,
  rows: Record<string, unknown>[],
  defaultYear: number,
): ParsedFinanceChargeback[] {
  const chargebacks: ParsedFinanceChargeback[] = [];

  rows.forEach((row, index) => {
    const get = rowGetter(row);
    const rowNumber = Number(row[metadataRowNumberKey] ?? index + 2);
    const clientName = cleanText(get("CLIENTE", "NOME CLIENTE", "NOME DO CLIENTE"));
    const amount = parseMoney(get("VALOR", "CHARGEBACK"));

    if (!clientName || amount <= 0) {
      return;
    }

    const chargedAt = parseDate(get("COBRADO", "DATA COBRADO"), defaultYear);

    chargebacks.push({
      chargeback_date: parseDate(get("CONTRATO", "DATA", "DATA CONTRATO"), defaultYear) ?? chargedAt ?? defaultDate,
      client_name: clientName,
      client_cpf: normalizeCpf(get("CPF")),
      amount,
      charged_at: chargedAt,
      status: chargedAt ? "charged" : "pending",
      source_hash: makeSourceHash(fileName, sheetName, rowNumber, "chargeback", row),
      notes: cleanText(get("OBSERVACAO", "OBSERVAÇÃO", "OBS")),
      sheet_name: sheetName,
      row_number: rowNumber,
      raw_data: row,
    });
  });

  return chargebacks;
}

function classifySheet(sheetName: string, rows: Record<string, unknown>[]) {
  const headers = new Set(
    Object.keys(rows[0] ?? {}).map((header) => normalizeText(header)),
  );
  const normalizedSheet = normalizeText(sheetName);

  if (
    normalizedSheet.includes("CHARGEBACK") ||
    (hasHeader(headers, "COBRADO") && hasHeader(headers, "VALOR") && hasHeader(headers, "CPF"))
  ) {
    return "chargeback";
  }

  if (
    hasHeader(headers, "VCTO", "VENCIMENTO") &&
    hasHeader(headers, "CONTAS A PAGAR", "CONTAS PAGAS", "GASTOS EXTRAS")
  ) {
    return "transaction";
  }

  if (
    hasHeader(headers, "NOME CLIENTE", "NOME DO CLIENTE", "CLIENTE") &&
    hasHeader(headers, "META", "CONTRATO", "VENDA")
  ) {
    return "sale";
  }

  return "ignored";
}

export function parseFinanceWorkbook(
  buffer: Buffer,
  fileName: string,
  defaultYear = new Date().getFullYear(),
): ParsedFinanceImport {
  const workbook = XLSX.read(buffer, {
    cellDates: true,
    type: "buffer",
  });
  const transactions: ParsedFinanceTransaction[] = [];
  const sales: ParsedFinanceSale[] = [];
  const chargebacks: ParsedFinanceChargeback[] = [];
  const ignoredRows: ParsedFinanceImport["ignoredRows"] = [];

  for (const sheetName of workbook.SheetNames) {
    const rows = getSheetRows(workbook, sheetName).filter((row) =>
      Object.values(row).some((value) => cleanText(value)),
    );

    if (!rows.length) {
      continue;
    }

    const sheetType = classifySheet(sheetName, rows);

    if (sheetType === "transaction") {
      transactions.push(...parseTransactionRows(fileName, sheetName, rows, defaultYear));
      continue;
    }

    if (sheetType === "sale") {
      sales.push(...parseSaleRows(fileName, sheetName, rows, defaultYear));
      continue;
    }

    if (sheetType === "chargeback") {
      chargebacks.push(...parseChargebackRows(fileName, sheetName, rows, defaultYear));
      continue;
    }

    rows.forEach((row, index) => {
      ignoredRows.push({
        sheet_name: sheetName,
        row_number: index + 2,
        reason: "Aba sem estrutura financeira reconhecida.",
        raw_data: row,
      });
    });
  }

  return {
    transactions,
    sales,
    chargebacks,
    ignoredRows,
    summary: {
      sheets: workbook.SheetNames.length,
      transactions: transactions.length,
      sales: sales.length,
      chargebacks: chargebacks.length,
      ignoredRows: ignoredRows.length,
    },
  };
}
