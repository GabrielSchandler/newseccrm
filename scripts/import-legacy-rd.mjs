import path from "node:path";
import process from "node:process";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const { loadEnvConfig } = nextEnv;

const LEGACY_SOURCE = "legacy_rd_tab_clientes";

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (!value.startsWith("--")) {
      continue;
    }

    const key = value.slice(2);
    const nextValue = argv[index + 1];

    if (!nextValue || nextValue.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = nextValue;
    index += 1;
  }

  return parsed;
}

function normalizeSupabaseUrl(value) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return "";
  }

  if (raw.startsWith("sb_publishable_") || raw.startsWith("eyJ")) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL esta com uma chave e nao com a URL do projeto. Use algo como https://SEU-PROJETO.supabase.co",
    );
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(raw);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL invalida. Use a URL base do projeto, por exemplo https://SEU-PROJETO.supabase.co",
    );
  }

  return parsedUrl.origin;
}

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function cleanDigits(value, { nullIfAllZeros = false } = {}) {
  const digits = onlyDigits(value);

  if (!digits) {
    return null;
  }

  if (nullIfAllZeros && /^0+$/.test(digits)) {
    return null;
  }

  return digits;
}

function normalizeText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();

  if (!normalized) {
    return null;
  }

  const sanitized = normalized
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  if (
    /^-+$/.test(normalized) ||
    sanitized === "em branco" ||
    sanitized === "nao definido" ||
    sanitized === "null" ||
    sanitized === "nulo" ||
    sanitized === "n/a"
  ) {
    return null;
  }

  return normalized;
}

function normalizeNameKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value).trim();

  if (!raw) {
    return null;
  }

  const normalized = raw
    .replace(/\s+/g, "")
    .replace(/R\$/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const digits = onlyDigits(value);
  return digits ? Number(digits) : null;
}

function parseDate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();

  if (!raw) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const brDate = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (brDate) {
    const [, day, month, year] = brDate;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeText(value);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function mapLeadMedia(value) {
  const normalized = normalizeNameKey(value);

  if (normalized.includes("soul")) {
    return "Soul";
  }

  if (normalized.includes("growper")) {
    return "Growper";
  }

  if (normalized.includes("prosperity")) {
    return "Prosperity";
  }

  return null;
}

function mapPreSaleType(serviceType, vehicleName) {
  if (normalizeText(vehicleName)) {
    return "veiculo";
  }

  const normalized = normalizeNameKey(
    [serviceType, vehicleName].filter(Boolean).join(" "),
  );

  if (normalized.includes("veiculo") || normalized.includes("carro") || normalized.includes("moto")) {
    return "veiculo";
  }

  if (normalized.includes("imovel") || normalized.includes("casa") || normalized.includes("apartamento")) {
    return "imovel";
  }

  return "emprestimo";
}

function mapPreSaleStatus(row) {
  const status = normalizeNameKey(row.Cli_Status);
  const legal = normalizeNameKey(row.Cli_StatusJd || row.Cli_StatusJdTx || row.Cli_StatusDoc);

  if (status.includes("perd")) {
    return "perdido";
  }

  if (
    status.includes("contrato") ||
    status.includes("pago") ||
    legal ||
    normalizeText(row.Cli_OpJuridico) ||
    normalizeText(row.Cli_NumeroProc)
  ) {
    return "aprovado";
  }

  if (status.includes("negoc")) {
    return "em_negociacao";
  }

  if (status.includes("contato")) {
    return "em_contato";
  }

  if (status.includes("lead")) {
    return "lead";
  }

  return "pre_venda";
}

function mapLegalStage(row) {
  const combined = normalizeNameKey(
    [
      row.Cli_StatusJd,
      row.Cli_StatusJdTx,
      row.Cli_StatusDoc,
      row.Cli_StJd,
      row.Cli_Andamento,
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (combined.includes("ciencia") || combined.includes("responsabilidade")) {
    return "pos_laudo_ciencia";
  }

  if (combined.includes("laudo") && combined.includes("pag")) {
    return "pagamento_laudo";
  }

  if (
    combined.includes("notific") ||
    combined.includes("dilig") ||
    combined.includes("perito") ||
    combined.includes("protocolo") ||
    normalizeText(row.Cli_NumeroProc)
  ) {
    return "diligencia_cobranca";
  }

  if (
    combined.includes("lgpd") ||
    combined.includes("hipo") ||
    combined.includes("procur")
  ) {
    return "lgpd_hipossuficiencia_procuracao";
  }

  return "termo_pagamento_servico";
}

function buildNegotiationDetails(row) {
  const parts = [
    normalizeText(row.Cli_OBS) ? `OBS: ${normalizeText(row.Cli_OBS)}` : null,
    normalizeText(row.Cli_Status) ? `Status legado: ${normalizeText(row.Cli_Status)}` : null,
    normalizeText(row.Cli_Andamento) ? `Andamento legado: ${normalizeText(row.Cli_Andamento)}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join("\n") : null;
}

function buildClientPayload(row) {
  return {
    full_name: firstNonEmpty(row.Cli_Nome),
    cpf: cleanDigits(row.Cli_CPF),
    rg: firstNonEmpty(row.Cli_RG),
    nationality: null,
    birth_date: parseDate(row.Cli_DtNascimento),
    marital_status: firstNonEmpty(row.Cli_EstadoCivil),
    profession: firstNonEmpty(row.Cli_Profissao),
    email: firstNonEmpty(row.Cli_Email),
    phone_mobile: cleanDigits(firstNonEmpty(row.Cli_Celular, row.Cli_telefone), {
      nullIfAllZeros: true,
    }),
    phone_secondary: cleanDigits(
      firstNonEmpty(
        row.Cli_telefone,
        row.Cli_Celular && row.Cli_telefone === row.Cli_Celular ? null : row.Cli_telefone,
      ),
      { nullIfAllZeros: true },
    ),
    zip_code: cleanDigits(row.Cli_CEP),
    street: firstNonEmpty(row.Cli_End),
    number: null,
    district: firstNonEmpty(row.Cli_Bairro),
    city: firstNonEmpty(row.Cli_Cidade),
    state: firstNonEmpty(row.Cli_UF),
    notes: firstNonEmpty(row.Cli_OBS),
  };
}

function buildSnapshotPayload(row, clientPayload) {
  return {
    full_name: firstNonEmpty(row.Cli_NomeR, clientPayload.full_name),
    cpf: cleanDigits(firstNonEmpty(row.Cli_CPFR, clientPayload.cpf)),
    rg: firstNonEmpty(row.Cli_RGR, clientPayload.rg),
    birth_date: parseDate(firstNonEmpty(row.Cli_DtNascimentoR, row.Cli_DtNascimento)),
    marital_status: firstNonEmpty(row.Cli_EstadoCivilR, clientPayload.marital_status),
    profession: firstNonEmpty(row.Cli_ProfissaoFin, clientPayload.profession),
    email: firstNonEmpty(row.Cli_EmailFin, clientPayload.email),
    phone_mobile: cleanDigits(firstNonEmpty(row.Cli_CelularR, clientPayload.phone_mobile), {
      nullIfAllZeros: true,
    }),
    phone_secondary: cleanDigits(firstNonEmpty(row.Cli_telefone, clientPayload.phone_secondary), {
      nullIfAllZeros: true,
    }),
    zip_code: cleanDigits(firstNonEmpty(row.Cli_CEPR, row.Cli_CEP)),
    street: firstNonEmpty(row.Cli_EndR, row.Cli_End),
    number: null,
    district: firstNonEmpty(row.Cli_BairroR, row.Cli_Bairro),
    city: firstNonEmpty(row.Cli_CidadeR, row.Cli_Cidade),
    state: firstNonEmpty(row.Cli_UFR, row.Cli_UF),
  };
}

function buildDebtHolderPayload(row, clientPayload) {
  return {
    full_name: clientPayload.full_name,
    cpf: clientPayload.cpf,
    rg: clientPayload.rg,
    birth_date: clientPayload.birth_date,
    marital_status: clientPayload.marital_status,
    profession: clientPayload.profession,
    nationality: clientPayload.nationality,
    issuer_agency: null,
    father_name: firstNonEmpty(row.Cli_Pai),
    mother_name: firstNonEmpty(row.Cli_Mae),
    phone_mobile: clientPayload.phone_mobile,
    phone_secondary: clientPayload.phone_secondary,
    email: clientPayload.email,
    zip_code: clientPayload.zip_code,
    street: clientPayload.street,
    number: clientPayload.number,
    district: clientPayload.district,
    city: clientPayload.city,
    state: clientPayload.state,
  };
}

function buildFinancialPayload(row, preSaleType) {
  return {
    financer_name: firstNonEmpty(row.Cli_Banco, row.Cli_Razao),
    financer_legal_name: firstNonEmpty(row.Cli_Razao),
    financer_cnpj: cleanDigits(row.Cli_CNPJ),
    financer_address: firstNonEmpty(row.Cli_End_CNPJ),
    financer_district: firstNonEmpty(row.Cli_Bairro_CNPJ),
    financer_zip_code: cleanDigits(row.Cli_CEP_CNPJ),
    financer_city: firstNonEmpty(row.Cli_Cidade_CNPJ),
    financer_state: firstNonEmpty(row.Cli_UF_CNPJ),
    has_financing_contract: Boolean(normalizeText(row.Cli_NContrato)),
    financed_amount: parseCurrency(row.Cli_VlFinanciamento),
    installment_amount: parseCurrency(row.Cli_VlParcela),
    paid_installments: parseInteger(row.Cli_ParcelasPg),
    overdue_installments: parseInteger(row.Cli_ParcelasAtraso),
    due_day: parseInteger(row.Cli_DiaVcto),
    contract_number: firstNonEmpty(row.Cli_NContrato, row.Cli_CtoRef),
    asset_brand_model: preSaleType === "veiculo" ? firstNonEmpty(row.Cli_Veiculo) : null,
    asset_color: preSaleType === "veiculo" ? firstNonEmpty(row.Cli_CorVeiculo) : null,
    asset_year: preSaleType === "veiculo" ? firstNonEmpty(row.Cli_Ano) : null,
    asset_plate: preSaleType === "veiculo" ? firstNonEmpty(row.Cli_Placa) : null,
  };
}

function buildPreSalePayload(row, consultantUserId, createdBy) {
  const preSaleType = mapPreSaleType(row.Cli_ServicoContratado, row.Cli_Veiculo);
  const status = mapPreSaleStatus(row);
  const contractValue = parseCurrency(row.Cli_Valor);
  const legalStage = status === "aprovado" ? mapLegalStage(row) : null;

  return {
    consultant_user_id: consultantUserId,
    pre_sale_type: preSaleType,
    status,
    service_type: firstNonEmpty(row.Cli_ServicoContratado),
    media: mapLeadMedia(row.Cli_TipoMidia),
    contract_value: contractValue,
    payment_description:
      firstNonEmpty(row.Cli_FormaPgto) ??
      (contractValue !== null ? "Migrado da base legacy RD." : "Nao informado"),
    negotiation_details: buildNegotiationDetails(row),
    legal_department: firstNonEmpty(row.Cli_Dpto),
    legal_status_text: firstNonEmpty(row.Cli_StatusJdTx, row.Cli_StatusJd, row.Cli_StJd),
    legal_document_status: firstNonEmpty(row.Cli_StatusDoc),
    legal_case_number: firstNonEmpty(row.Cli_NumeroProc),
    legal_case_year: firstNonEmpty(row.Cli_AnoProc),
    legal_deadline: firstNonEmpty(row.Cli_Prazo),
    legal_county: firstNonEmpty(row.Cli_Comarca),
    legal_forum: firstNonEmpty(row.Cli_Forum),
    legal_court_division: firstNonEmpty(row.Cli_Vara),
    legal_operator_name: firstNonEmpty(row.Cli_OpJuridico),
    legal_process_operator_name: firstNonEmpty(row.Cli_OpProcessual),
    legal_protocol: firstNonEmpty(row.Cli_ProtocoloD),
    legal_stage: legalStage,
    legal_stage_updated_at:
      parseDate(row.Cli_DtStatusJd) ??
      parseDate(row.Cli_DtStatus) ??
      parseDate(row.Cli_DtContrato),
    created_by: createdBy,
    legacy_source: LEGACY_SOURCE,
    legacy_external_id: firstNonEmpty(row.Cli_Id),
    opened_at:
      parseDate(row.Cli_DtContato) ??
      parseDate(row.Cli_DtContrato) ??
      parseDate(row.Cli_DtStatus),
  };
}

function buildPayments(row, preSalePayload) {
  const amount = preSalePayload.contract_value;
  const paymentMethod = firstNonEmpty(row.Cli_FormaPgto);

  if (amount === null && !paymentMethod) {
    return [];
  }

  return [
    {
      installment_number: 1,
      amount,
      payment_method: paymentMethod,
      payment_date: parseDate(row.Cli_DtContrato),
      status: parseDate(row.Cli_DtContrato) ? "pago" : "previsto",
    },
  ];
}

function mergePreferExisting(existing, incoming) {
  const merged = { ...existing };

  for (const [key, value] of Object.entries(incoming)) {
    const current = existing[key];

    if (current !== null && current !== undefined && current !== "") {
      continue;
    }

    merged[key] = value;
  }

  return merged;
}

function normalizeRow(row, rowNumber, consultantUserId, createdBy) {
  const clientPayload = buildClientPayload(row);

  if (!clientPayload.full_name || onlyDigits(clientPayload.cpf).length !== 11) {
    return null;
  }

  const preSalePayload = buildPreSalePayload(row, consultantUserId, createdBy);
  const preSaleType = preSalePayload.pre_sale_type;

  return {
    rowNumber,
    legacyExternalId: preSalePayload.legacy_external_id ?? String(rowNumber),
    raw: row,
    client: clientPayload,
    snapshot: buildSnapshotPayload(row, clientPayload),
    debtHolder: buildDebtHolderPayload(row, clientPayload),
    financial: buildFinancialPayload(row, preSaleType),
    preSale: preSalePayload,
    payments: buildPayments(row, preSalePayload),
  };
}

function buildConsultantIndex(profiles) {
  const emailMap = new Map();
  const nameMap = new Map();

  for (const profile of profiles) {
    if (profile.email) {
      emailMap.set(profile.email.toLowerCase(), profile.id);
    }

    for (const candidate of [profile.full_name, profile.nickname, profile.username]) {
      const key = normalizeNameKey(candidate);

      if (key) {
        nameMap.set(key, profile.id);
      }
    }
  }

  return { emailMap, nameMap };
}

function resolveConsultantId(row, consultantIndex, fallbackConsultantId) {
  const email = normalizeText(row.Cli_emailConsultor)?.toLowerCase();

  if (email && consultantIndex.emailMap.has(email)) {
    return consultantIndex.emailMap.get(email);
  }

  const operator = normalizeNameKey(row.Cli_Operador);

  if (operator && consultantIndex.nameMap.has(operator)) {
    return consultantIndex.nameMap.get(operator);
  }

  return fallbackConsultantId ?? null;
}

async function ensureLegacyImportRow(supabase, companyId, normalizedRow, importStatus, extras = {}) {
  const payload = {
    company_id: companyId,
    source_row_number: normalizedRow.rowNumber,
    legacy_external_id: normalizedRow.legacyExternalId,
    payload: normalizedRow.raw,
    import_status: importStatus,
    ...extras,
  };

  if (normalizedRow.legacyExternalId) {
    const { error } = await supabase
      .from("legacy_rd_import")
      .upsert(payload, {
        onConflict: "company_id,legacy_external_id",
      });

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase.from("legacy_rd_import").insert(payload);

  if (error) {
    throw error;
  }
}

async function fetchCompanyProfiles(supabase, companyId) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, nickname, username, email, role")
    .eq("company_id", companyId)
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function fetchExistingClients(supabase, companyId) {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  const map = new Map();

  for (const client of data ?? []) {
    const cpf = onlyDigits(client.cpf);

    if (cpf) {
      map.set(cpf, client);
    }
  }

  return map;
}

async function fetchExistingPreSales(supabase, companyId, legacyExternalIds) {
  if (!legacyExternalIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("pre_sales")
    .select("*")
    .eq("company_id", companyId)
    .eq("legacy_source", LEGACY_SOURCE)
    .in("legacy_external_id", legacyExternalIds);

  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((item) => [item.legacy_external_id, item]));
}

async function upsertChildRecord(supabase, table, preSaleId, values) {
  const { data, error } = await supabase
    .from(table)
    .select("pre_sale_id")
    .eq("pre_sale_id", preSaleId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data?.pre_sale_id) {
    const { error: updateError } = await supabase
      .from(table)
      .update(values)
      .eq("pre_sale_id", preSaleId);

    if (updateError) {
      throw updateError;
    }

    return;
  }

  const { error: insertError } = await supabase.from(table).insert({
    pre_sale_id: preSaleId,
    ...values,
  });

  if (insertError) {
    throw insertError;
  }
}

async function upsertPayments(supabase, preSaleId, payments) {
  const { data, error } = await supabase
    .from("pre_sale_payments")
    .select("id")
    .eq("pre_sale_id", preSaleId)
    .limit(1);

  if (error) {
    throw error;
  }

  if ((data ?? []).length) {
    return;
  }

  if (!payments.length) {
    return;
  }

  const payload = payments.map((payment) => ({
    pre_sale_id: preSaleId,
    ...payment,
  }));

  const { error: insertError } = await supabase.from("pre_sale_payments").insert(payload);

  if (insertError) {
    throw insertError;
  }
}

async function upsertClient(supabase, companyId, createdBy, clientsMap, clientPayload) {
  const clientKey = onlyDigits(clientPayload.cpf);
  const existingClient = clientsMap.get(clientKey);

  if (existingClient) {
    const merged = mergePreferExisting(existingClient, clientPayload);

    const { data, error } = await supabase
      .from("clients")
      .update({
        ...merged,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingClient.id)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    clientsMap.set(clientKey, data);
    return data;
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      ...clientPayload,
      company_id: companyId,
      created_by: createdBy,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  clientsMap.set(clientKey, data);
  return data;
}

async function upsertPreSale(supabase, companyId, preSalesMap, normalizedRow, clientId) {
  const preSalePayload = {
    company_id: companyId,
    client_id: clientId,
    consultant_user_id: normalizedRow.preSale.consultant_user_id,
    pre_sale_type: normalizedRow.preSale.pre_sale_type,
    status: normalizedRow.preSale.status,
    service_type: normalizedRow.preSale.service_type,
    media: normalizedRow.preSale.media,
    contract_value: normalizedRow.preSale.contract_value,
    payment_description: normalizedRow.preSale.payment_description,
    negotiation_details: normalizedRow.preSale.negotiation_details,
    legal_department: normalizedRow.preSale.legal_department,
    legal_status_text: normalizedRow.preSale.legal_status_text,
    legal_document_status: normalizedRow.preSale.legal_document_status,
    legal_case_number: normalizedRow.preSale.legal_case_number,
    legal_case_year: normalizedRow.preSale.legal_case_year,
    legal_deadline: normalizedRow.preSale.legal_deadline,
    legal_county: normalizedRow.preSale.legal_county,
    legal_forum: normalizedRow.preSale.legal_forum,
    legal_court_division: normalizedRow.preSale.legal_court_division,
    legal_operator_name: normalizedRow.preSale.legal_operator_name,
    legal_process_operator_name: normalizedRow.preSale.legal_process_operator_name,
    legal_protocol: normalizedRow.preSale.legal_protocol,
    legal_stage: normalizedRow.preSale.legal_stage,
    legal_stage_updated_at:
      normalizedRow.preSale.legal_stage_updated_at ?? new Date().toISOString(),
    created_by: normalizedRow.preSale.created_by,
    legacy_source: LEGACY_SOURCE,
    legacy_external_id: normalizedRow.legacyExternalId,
  };

  const existingPreSale = preSalesMap.get(normalizedRow.legacyExternalId);

  if (existingPreSale) {
    const merged = mergePreferExisting(existingPreSale, preSalePayload);

    const { data, error } = await supabase
      .from("pre_sales")
      .update({
        ...merged,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingPreSale.id)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    preSalesMap.set(normalizedRow.legacyExternalId, data);
    return data;
  }

  const { data, error } = await supabase
    .from("pre_sales")
    .insert(preSalePayload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  preSalesMap.set(normalizedRow.legacyExternalId, data);
  return data;
}

function printUsage() {
  console.log(
    [
      "Uso:",
      "node scripts/import-legacy-rd.mjs --file <xlsx> --company-id <uuid> --created-by <user_profile_id> [--consultant-fallback <user_profile_id>] [--sheet Tab_Clientes] [--limit 10] [--apply]",
      "",
      "Sem --apply, o script roda em modo diagnostico.",
    ].join("\n"),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = Boolean(args.apply);

  if (!args.file || (apply && (!args["company-id"] || !args["created-by"]))) {
    printUsage();
    process.exit(1);
  }

  const cwd = process.cwd();
  const filePath = path.resolve(String(args.file));
  const sheetName = String(args.sheet || "Tab_Clientes");
  const limit = args.limit ? Number(args.limit) : null;
  const companyId = args["company-id"] ? String(args["company-id"]) : null;
  const createdBy = args["created-by"] ? String(args["created-by"]) : null;
  const fallbackConsultantId = args["consultant-fallback"]
    ? String(args["consultant-fallback"])
    : null;

  const workbook = XLSX.readFile(filePath, {
    cellDates: true,
    raw: false,
  });
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`A aba ${sheetName} nao existe no arquivo informado.`);
  }

  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    defval: null,
  });

  let supabase = null;
  let profiles = [];
  let clientsMap = new Map();
  let preSalesMap = new Map();

  if (apply) {
    loadEnvConfig(cwd);

    const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Variaveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias.");
    }

    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    profiles = await fetchCompanyProfiles(supabase, companyId);
    clientsMap = await fetchExistingClients(supabase, companyId);
  }

  const consultantIndex = buildConsultantIndex(profiles);
  const legacyExternalIds = rawRows
    .map((row) => firstNonEmpty(row.Cli_Id))
    .filter(Boolean);

  if (apply) {
    preSalesMap = await fetchExistingPreSales(supabase, companyId, legacyExternalIds);
  }

  const normalizedRows = rawRows
    .map((row, index) => {
      const consultantUserId = resolveConsultantId(row, consultantIndex, fallbackConsultantId);
      return normalizeRow(row, index + 2, consultantUserId, createdBy);
    })
    .filter(Boolean);

  const limitedRows = limit ? normalizedRows.slice(0, limit) : normalizedRows;
  const stats = {
    totalRows: rawRows.length,
    validRows: limitedRows.length,
    skippedRows: rawRows.length - normalizedRows.length,
    createdClients: 0,
    updatedClients: 0,
    createdPreSales: 0,
    updatedPreSales: 0,
    errors: 0,
  };

  console.log(`Arquivo: ${filePath}`);
  console.log(`Aba: ${sheetName}`);
  console.log(`Linhas lidas: ${rawRows.length}`);
  console.log(`Linhas validas para importacao: ${limitedRows.length}`);
  console.log(`Modo: ${apply ? "APLICAR" : "DIAGNOSTICO"}`);

  if (!apply) {
    console.log("\nExemplo das 3 primeiras linhas normalizadas:");
    console.log(JSON.stringify(limitedRows.slice(0, 3), null, 2));
    return;
  }

  for (const normalizedRow of limitedRows) {
    try {
      await ensureLegacyImportRow(supabase, companyId, normalizedRow, "processing");

      const existingClient = clientsMap.get(onlyDigits(normalizedRow.client.cpf));
      const client = await upsertClient(
        supabase,
        companyId,
        createdBy,
        clientsMap,
        normalizedRow.client,
      );
      stats[existingClient ? "updatedClients" : "createdClients"] += 1;

      const existingPreSale = preSalesMap.get(normalizedRow.legacyExternalId);
      const preSale = await upsertPreSale(
        supabase,
        companyId,
        preSalesMap,
        normalizedRow,
        client.id,
      );
      stats[existingPreSale ? "updatedPreSales" : "createdPreSales"] += 1;

      await upsertChildRecord(supabase, "pre_sale_client_snapshot", preSale.id, normalizedRow.snapshot);
      await upsertChildRecord(supabase, "pre_sale_debt_holders", preSale.id, normalizedRow.debtHolder);
      await upsertChildRecord(supabase, "pre_sale_financial_cases", preSale.id, normalizedRow.financial);
      await upsertPayments(supabase, preSale.id, normalizedRow.payments);

      await ensureLegacyImportRow(supabase, companyId, normalizedRow, "imported", {
        processed_at: new Date().toISOString(),
        error_message: null,
        imported_client_id: client.id,
        imported_pre_sale_id: preSale.id,
      });
    } catch (error) {
      stats.errors += 1;
      const message = error instanceof Error ? error.message : "Erro desconhecido na importacao.";

      console.error(`Linha ${normalizedRow.rowNumber}: ${message}`);

      await ensureLegacyImportRow(supabase, companyId, normalizedRow, "error", {
        processed_at: new Date().toISOString(),
        error_message: message,
      });
    }
  }

  console.log("\nResumo da importacao:");
  console.table(stats);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
