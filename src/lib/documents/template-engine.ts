import {
  displayCpf,
  displayPhone,
  displayValue,
  formatDate,
  formatDateTime,
} from "@/lib/clients/formatters";
import {
  formatBoolean,
  formatCurrency,
  formatPreSaleType,
} from "@/lib/pre-sales/formatters";
import type { Client } from "@/types/client";
import type {
  PreSale,
  PreSaleClientSnapshot,
  PreSaleDebtHolder,
  PreSaleFinancialCase,
  PreSalePayment,
  UserProfileOption,
} from "@/types/pre-sale";

export type DocumentCompany = {
  id?: string;
  legal_name?: string | null;
  corporate_name?: string | null;
  razao_social?: string | null;
  trade_name?: string | null;
  fantasy_name?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
};

export type DocumentTemplateContext = {
  preSale: PreSale;
  client: Client | null;
  snapshot: PreSaleClientSnapshot | null;
  debtHolder: PreSaleDebtHolder | null;
  financialCase: PreSaleFinancialCase | null;
  company: DocumentCompany | null;
  consultant: UserProfileOption | null;
  payments: PreSalePayment[];
};

export type RenderedDocument = {
  content: string;
  variables: Record<string, string>;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const paymentDocumentVariables = Array.from({ length: 10 }, (_, index) => {
  const paymentIndex = index + 1;

  return [
    `pagamento_${paymentIndex}_metodo`,
    `pagamento_${paymentIndex}_forma`,
    `pagamento_${paymentIndex}_valor`,
    `pagamento_${paymentIndex}_valor_extenso`,
    `pagamento_${paymentIndex}_valor_com_extenso`,
    `pagamento_${paymentIndex}_parcelas`,
    `pagamento_${paymentIndex}_parcelas_texto`,
    `pagamento_${paymentIndex}_data`,
    `pagamento_${paymentIndex}_status`,
    `pagamento_${paymentIndex}_resumo`,
  ];
}).flat();

export const documentVariableCatalog = [
  {
    group: "Cliente",
    variables: [
      "cliente_id",
      "cliente_nome",
      "cliente_cpf",
      "cliente_rg",
      "cliente_data_nascimento",
      "cliente_estado_civil",
      "cliente_profissao",
      "cliente_email",
      "cliente_celular",
      "cliente_telefone_secundario",
      "cliente_cep",
      "cliente_rua",
      "cliente_numero",
      "cliente_bairro",
      "cliente_cidade",
      "cliente_estado",
    ],
  },
  {
    group: "Contratante",
    variables: [
      "contratante_nome",
      "contratante_cpf",
      "contratante_rg",
      "contratante_data_nascimento",
      "contratante_estado_civil",
      "contratante_profissao",
      "contratante_email",
      "contratante_celular",
      "contratante_telefone_secundario",
      "contratante_cep",
      "contratante_rua",
      "contratante_numero",
      "contratante_bairro",
      "contratante_cidade",
      "contratante_estado",
      "contratante_endereco_completo",
    ],
  },
  {
    group: "Titular da divida",
    variables: [
      "titular_nome",
      "titular_cpf",
      "titular_rg",
      "titular_data_nascimento",
      "titular_estado_civil",
      "titular_profissao",
      "titular_nacionalidade",
      "titular_orgao_emissor",
      "titular_pai",
      "titular_mae",
      "titular_email",
      "titular_celular",
      "titular_telefone_secundario",
      "titular_cep",
      "titular_rua",
      "titular_numero",
      "titular_bairro",
      "titular_cidade",
      "titular_estado",
      "titular_endereco_completo",
    ],
  },
  {
    group: "Pre-venda",
    variables: [
      "pre_venda_id",
      "pre_venda_tipo",
      "pre_venda_status",
      "pre_venda_servico",
      "pre_venda_midia",
      "pre_venda_data_abertura",
      "pre_venda_observacoes",
    ],
  },
  {
    group: "Dados financeiros",
    variables: [
      "financeira",
      "possui_contrato_financiamento",
      "valor_operacao",
      "valor_entrada",
      "valor_parcela",
      "quantidade_parcelas",
      "parcelas_pagas",
      "parcelas_atrasadas",
      "dia_vencimento",
      "numero_contrato_financiamento",
    ],
  },
  {
    group: "Veiculo",
    variables: [
      "veiculo_modelo",
      "veiculo_cor",
      "veiculo_ano",
      "veiculo_placa",
    ],
  },
  {
    group: "Contratacao",
    variables: ["valor_contrato", "descricao_pagamento", "data_contrato"],
  },
  {
    group: "Pagamentos",
    variables: [
      "pagamento_quantidade",
      "pagamento_total",
      "pagamento_total_extenso",
      "pagamento_total_com_extenso",
      "pagamentos_resumo",
      ...paymentDocumentVariables,
    ],
  },
  {
    group: "Empresa",
    variables: ["empresa_razao_social", "empresa_nome_fantasia", "empresa_cnpj"],
  },
  {
    group: "Consultor",
    variables: ["consultor_nome", "consultor_login", "consultor_email"],
  },
  {
    group: "Auxiliares",
    variables: ["data_atual", "hora_atual"],
  },
] as const;

function emptyDash(value: string) {
  return value === "-" ? "" : value;
}

function formatText(value: string | null | undefined) {
  return emptyDash(displayValue(value ?? null));
}

function formatCpfValue(value: string | null | undefined) {
  return emptyDash(displayCpf(value ?? null));
}

function formatPhoneValue(value: string | null | undefined) {
  return emptyDash(displayPhone(value ?? null));
}

function formatDateValue(value: string | null | undefined) {
  return emptyDash(formatDate(value ?? null));
}

function formatCurrencyValue(value: number | string | null | undefined) {
  return emptyDash(formatCurrency(value ?? null));
}

const PT_BR_MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

const UNITS = [
  "zero",
  "um",
  "dois",
  "tres",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
] as const;

const TEENS = [
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
] as const;

const TENS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
] as const;

const HUNDREDS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
] as const;

function parseNumericValue(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value
      .trim()
      .replace(/\./g, "")
      .replace(",", ".");
    const parsed = Number(normalized);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function numberToWordsUnderOneThousand(value: number): string {
  if (value === 0) {
    return "";
  }

  if (value < 10) {
    return UNITS[value] ?? "";
  }

  if (value < 20) {
    return TEENS[value - 10] ?? "";
  }

  if (value < 100) {
    const tens = Math.floor(value / 10);
    const unit = value % 10;
    return unit ? `${TENS[tens]} e ${UNITS[unit]}` : TENS[tens] ?? "";
  }

  if (value === 100) {
    return "cem";
  }

  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const hundredText = HUNDREDS[hundreds] ?? "";

  return remainder
    ? `${hundredText} e ${numberToWordsUnderOneThousand(remainder)}`
    : hundredText;
}

function joinParts(parts: string[]) {
  if (parts.length <= 1) {
    return parts[0] ?? "";
  }

  if (parts.length === 2) {
    return `${parts[0]} e ${parts[1]}`;
  }

  return `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}`;
}

function numberToPortugueseWords(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "";
  }

  if (value === 0) {
    return "zero";
  }

  const billions = Math.floor(value / 1_000_000_000);
  const millions = Math.floor((value % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((value % 1_000_000) / 1_000);
  const hundreds = value % 1_000;
  const parts: string[] = [];

  if (billions) {
    parts.push(
      billions === 1
        ? "um bilhão"
        : `${numberToWordsUnderOneThousand(billions)} bilhões`,
    );
  }

  if (millions) {
    parts.push(
      millions === 1
        ? "um milhão"
        : `${numberToWordsUnderOneThousand(millions)} milhões`,
    );
  }

  if (thousands) {
    parts.push(
      thousands === 1
        ? "mil"
        : `${numberToWordsUnderOneThousand(thousands)} mil`,
    );
  }

  if (hundreds) {
    parts.push(numberToWordsUnderOneThousand(hundreds));
  }

  return joinParts(parts.filter(Boolean));
}

function capitalizeFirstLetter(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatLongDatePtBr(date: Date) {
  const day = date.getDate();
  const month = PT_BR_MONTHS[date.getMonth()] ?? "";
  const year = date.getFullYear();
  return `${day} de ${month} de ${year}`;
}

function formatCurrencyWordsOnly(value: number | string | null | undefined) {
  const numericValue = parseNumericValue(value);

  if (numericValue === null) {
    return "";
  }

  const absoluteValue = Math.abs(numericValue);
  const rounded = Math.round((absoluteValue + Number.EPSILON) * 100) / 100;
  const integerPart = Math.floor(rounded);
  const cents = Math.round((rounded - integerPart) * 100);
  const integerWords = numberToPortugueseWords(integerPart);
  const centsWords = numberToPortugueseWords(cents);

  const currencyParts: string[] = [];

  if (integerPart > 0 || cents === 0) {
    currencyParts.push(
      `${integerWords} ${integerPart === 1 ? "real" : "reais"}`,
    );
  }

  if (cents > 0) {
    currencyParts.push(
      `${centsWords} ${cents === 1 ? "centavo" : "centavos"}`,
    );
  }

  return capitalizeFirstLetter(joinParts(currencyParts.filter(Boolean)) || "Zero reais");
}

function formatCurrencyWithWords(value: number | string | null | undefined) {
  const numericValue = parseNumericValue(value);

  if (numericValue === null) {
    return "";
  }

  const rounded = Math.round((Math.abs(numericValue) + Number.EPSILON) * 100) / 100;
  const words = formatCurrencyWordsOnly(rounded);

  return `${formatCurrencyValue(rounded)} (${words})`;
}

function formatInstallmentCount(value: number | string | null | undefined) {
  const numericValue = parseNumericValue(value);

  if (numericValue === null) {
    return "";
  }

  const rounded = Math.max(0, Math.round(numericValue));
  return rounded ? String(rounded) : "";
}

function buildAddress(
  source:
    | Pick<
        PreSaleClientSnapshot,
        "street" | "number" | "district" | "city" | "state" | "zip_code"
      >
    | Pick<PreSaleDebtHolder, "street" | "number" | "district" | "city" | "state" | "zip_code">
    | null,
) {
  if (!source) {
    return "";
  }

  const streetLine = [
    source.street,
    source.number ? `n. ${source.number}` : null,
  ].filter(Boolean);
  const cityLine = [source.district, source.city, source.state].filter(Boolean);
  const zipCode = source.zip_code ? `CEP ${source.zip_code}` : null;

  return [streetLine.join(", "), cityLine.join(" - "), zipCode]
    .filter(Boolean)
    .join(", ");
}

function stringFromUnknown(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function hasPaymentContent(payment: PreSalePayment) {
  return Boolean(
    parseNumericValue(payment.amount) !== null ||
      formatText(payment.payment_method) ||
      formatInstallmentCount(payment.installment_number) ||
      formatDateValue(payment.payment_date) ||
      formatText(payment.status),
  );
}

type PaymentGroup = {
  method: string;
  items: PreSalePayment[];
};

function normalizePaymentMethod(value: string | null | undefined) {
  return formatText(value).trim().toLowerCase();
}

function groupPayments(payments: PreSalePayment[]) {
  const groups: PaymentGroup[] = [];
  const methodIndex = new Map<string, number>();

  payments.forEach((payment, index) => {
    const method = formatText(payment.payment_method);
    const normalizedMethod = normalizePaymentMethod(payment.payment_method);
    const uniqueKey = normalizedMethod || `__payment_${index}`;
    const existingIndex = methodIndex.get(uniqueKey);

    if (existingIndex === undefined) {
      methodIndex.set(uniqueKey, groups.length);
      groups.push({
        method,
        items: [payment],
      });
      return;
    }

    groups[existingIndex]?.items.push(payment);
  });

  return groups.slice(0, 10);
}

function groupPaymentTotal(group: PaymentGroup) {
  const total = group.items.reduce((sum, payment) => {
    const amount = parseNumericValue(payment.amount);
    return sum + (amount ?? 0);
  }, 0);

  return Math.round((total + Number.EPSILON) * 100) / 100;
}

function buildPaymentLineSummary(group: PaymentGroup) {
  const amount = formatCurrencyWithWords(groupPaymentTotal(group));
  const method = group.method;
  const installmentsCount = group.items.length;
  const parts = [amount];

  if (method) {
    parts.push(`via ${method}`);
  }

  if (installmentsCount > 1) {
    parts.push(`em ${installmentsCount} parcelas`);
  }

  return parts
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPaymentVariables(
  payments: PreSalePayment[],
  fallbackTotal: number | string | null | undefined,
) {
  const paymentGroups = groupPayments(payments.filter(hasPaymentContent));
  const totals = paymentGroups.map(groupPaymentTotal).filter((value) => value > 0);
  const totalValue =
    totals.length > 0
      ? Math.round(
          (totals.reduce((sum, currentValue) => sum + currentValue, 0) + Number.EPSILON) * 100,
        ) / 100
      : parseNumericValue(fallbackTotal);
  const variables: Record<string, string> = {
    pagamento_quantidade: paymentGroups.length ? String(paymentGroups.length) : "",
    pagamento_total: totalValue === null ? "" : formatCurrencyValue(totalValue),
    pagamento_total_extenso: totalValue === null ? "" : formatCurrencyWordsOnly(totalValue),
    pagamento_total_com_extenso:
      totalValue === null ? "" : formatCurrencyWithWords(totalValue),
    pagamentos_resumo: paymentGroups.map(buildPaymentLineSummary).filter(Boolean).join(" e "),
  };

  for (let index = 0; index < 10; index += 1) {
    const group = paymentGroups[index];
    const payment = group?.items[0];
    const paymentIndex = index + 1;
    const groupedTotal = group ? groupPaymentTotal(group) : null;
    const groupedInstallments = group && group.items.length > 1 ? String(group.items.length) : "";

    variables[`pagamento_${paymentIndex}_metodo`] = group?.method ?? "";
    variables[`pagamento_${paymentIndex}_forma`] = group?.method ?? "";
    variables[`pagamento_${paymentIndex}_valor`] =
      groupedTotal === null ? "" : formatCurrencyValue(groupedTotal);
    variables[`pagamento_${paymentIndex}_valor_extenso`] =
      groupedTotal === null ? "" : formatCurrencyWordsOnly(groupedTotal);
    variables[`pagamento_${paymentIndex}_valor_com_extenso`] =
      groupedTotal === null ? "" : formatCurrencyWithWords(groupedTotal);
    variables[`pagamento_${paymentIndex}_parcelas`] = groupedInstallments;
    variables[`pagamento_${paymentIndex}_parcelas_texto`] = groupedInstallments
      ? `em ${groupedInstallments} parcelas`
      : "";
    variables[`pagamento_${paymentIndex}_data`] = payment
      ? formatDateValue(payment.payment_date)
      : "";
    variables[`pagamento_${paymentIndex}_status`] = payment
      ? formatText(payment.status)
      : "";
    variables[`pagamento_${paymentIndex}_resumo`] = group
      ? buildPaymentLineSummary(group)
      : "";
  }

  return variables;
}

export function buildDocumentVariables(context: DocumentTemplateContext) {
  const {
    preSale,
    client,
    snapshot,
    debtHolder,
    financialCase,
    company,
    consultant,
    payments,
  } = context;
  const now = new Date();
  const companyRecord = (company ?? {}) as Record<string, unknown>;
  const paymentVariables = buildPaymentVariables(payments, preSale.contract_value);

  const variables = {
    cliente_id: client?.id ?? "",
    cliente_nome: formatText(client?.full_name),
    cliente_cpf: formatCpfValue(client?.cpf),
    cliente_rg: formatText(client?.rg),
    cliente_data_nascimento: formatDateValue(client?.birth_date),
    cliente_estado_civil: formatText(client?.marital_status),
    cliente_profissao: formatText(client?.profession),
    cliente_email: formatText(client?.email),
    cliente_celular: formatPhoneValue(client?.phone_mobile),
    cliente_telefone_secundario: formatPhoneValue(client?.phone_secondary),
    cliente_cep: formatText(client?.zip_code),
    cliente_rua: formatText(client?.street),
    cliente_numero: formatText(client?.number),
    cliente_bairro: formatText(client?.district),
    cliente_cidade: formatText(client?.city),
    cliente_estado: formatText(client?.state),
    contratante_nome: formatText(snapshot?.full_name),
    contratante_cpf: formatCpfValue(snapshot?.cpf),
    contratante_rg: formatText(snapshot?.rg),
    contratante_data_nascimento: formatDateValue(snapshot?.birth_date),
    contratante_estado_civil: formatText(snapshot?.marital_status),
    contratante_profissao: formatText(snapshot?.profession),
    contratante_email: formatText(snapshot?.email),
    contratante_celular: formatPhoneValue(snapshot?.phone_mobile),
    contratante_telefone_secundario: formatPhoneValue(snapshot?.phone_secondary),
    contratante_cep: formatText(snapshot?.zip_code),
    contratante_rua: formatText(snapshot?.street),
    contratante_numero: formatText(snapshot?.number),
    contratante_bairro: formatText(snapshot?.district),
    contratante_cidade: formatText(snapshot?.city),
    contratante_estado: formatText(snapshot?.state),
    contratante_endereco_completo: buildAddress(snapshot),
    titular_nome: formatText(debtHolder?.full_name),
    titular_cpf: formatCpfValue(debtHolder?.cpf),
    titular_rg: formatText(debtHolder?.rg),
    titular_data_nascimento: formatDateValue(debtHolder?.birth_date),
    titular_estado_civil: formatText(debtHolder?.marital_status),
    titular_profissao: formatText(debtHolder?.profession),
    titular_nacionalidade: formatText(debtHolder?.nationality),
    titular_orgao_emissor: formatText(debtHolder?.issuer_agency),
    titular_pai: formatText(debtHolder?.father_name),
    titular_mae: formatText(debtHolder?.mother_name),
    titular_email: formatText(debtHolder?.email),
    titular_celular: formatPhoneValue(debtHolder?.phone_mobile),
    titular_telefone_secundario: formatPhoneValue(debtHolder?.phone_secondary),
    titular_cep: formatText(debtHolder?.zip_code),
    titular_rua: formatText(debtHolder?.street),
    titular_numero: formatText(debtHolder?.number),
    titular_bairro: formatText(debtHolder?.district),
    titular_cidade: formatText(debtHolder?.city),
    titular_estado: formatText(debtHolder?.state),
    titular_endereco_completo: buildAddress(debtHolder),
    pre_venda_id: preSale.id,
    pre_venda_tipo: formatPreSaleType(preSale.pre_sale_type),
    pre_venda_status: formatText(preSale.status),
    pre_venda_servico: formatText(preSale.service_type),
    pre_venda_midia: formatText(preSale.media),
    pre_venda_data_abertura: emptyDash(formatDateTime(preSale.created_at)),
    pre_venda_observacoes: formatText(preSale.negotiation_details),
    financeira: formatText(financialCase?.financer_name),
    possui_contrato_financiamento: emptyDash(
      formatBoolean(financialCase?.has_financing_contract),
    ),
    valor_operacao: formatCurrencyValue(financialCase?.financed_amount),
    valor_entrada: "",
    valor_parcela: formatCurrencyValue(financialCase?.installment_amount),
    quantidade_parcelas: "",
    parcelas_pagas: formatText(
      financialCase?.paid_installments === null ||
        financialCase?.paid_installments === undefined
        ? null
        : String(financialCase.paid_installments),
    ),
    parcelas_atrasadas: formatText(
      financialCase?.overdue_installments === null ||
        financialCase?.overdue_installments === undefined
        ? null
        : String(financialCase.overdue_installments),
    ),
    dia_vencimento: formatText(
      financialCase?.due_day === null || financialCase?.due_day === undefined
        ? null
        : String(financialCase.due_day),
    ),
    numero_contrato_financiamento: formatText(financialCase?.contract_number),
    veiculo_modelo: formatText(financialCase?.asset_brand_model),
    veiculo_cor: formatText(financialCase?.asset_color),
    veiculo_ano: formatText(
      financialCase?.asset_year === null || financialCase?.asset_year === undefined
        ? null
        : String(financialCase.asset_year),
    ),
    veiculo_placa: formatText(financialCase?.asset_plate),
    valor_contrato: formatCurrencyWithWords(preSale.contract_value),
    descricao_pagamento: formatText(preSale.payment_description),
    data_contrato: formatLongDatePtBr(now),
    empresa_razao_social:
      stringFromUnknown(companyRecord.legal_name) ||
      stringFromUnknown(companyRecord.corporate_name) ||
      stringFromUnknown(companyRecord.razao_social),
    empresa_nome_fantasia:
      stringFromUnknown(companyRecord.trade_name) ||
      stringFromUnknown(companyRecord.fantasy_name) ||
      stringFromUnknown(companyRecord.nome_fantasia),
      empresa_cnpj: stringFromUnknown(companyRecord.cnpj),
      consultor_nome: formatText(consultant?.full_name ?? consultant?.username ?? consultant?.email),
      consultor_login: formatText(consultant?.username ?? consultant?.email),
      consultor_email: formatText(consultant?.username ?? consultant?.email),
      data_atual: new Intl.DateTimeFormat("pt-BR").format(now),
    hora_atual: new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(now),
    ...paymentVariables,
  } satisfies Record<string, string>;

  return variables as Record<string, string>;
}

export function renderDocumentTemplate(
  content: string,
  context: DocumentTemplateContext,
): RenderedDocument {
  const variables = buildDocumentVariables(context);
  const renderedContent = content.replace(
    /{{\s*([\w_]+)\s*}}/g,
    (_, key: string) => escapeHtml(variables[key] ?? ""),
  );

  return {
    content: renderedContent,
    variables,
  };
}
