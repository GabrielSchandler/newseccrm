import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  type DocumentProps,
} from "@react-pdf/renderer";
import {
  formatCalculationCurrency,
  formatCalculationDate,
  formatCpfDigits,
} from "@/lib/calculations/formatters";
import { formatCnpj, formatPhone } from "@/lib/clients/masks";
import { formatPreSaleType } from "@/lib/pre-sales/formatters";
import type { FinancingCalculation } from "@/types/calculation";

const COLORS = {
  text: "#111111",
  muted: "#6b7280",
  subtle: "#f5f5f5",
  border: "#d4d4d8",
  borderStrong: "#111111",
  accent: "#b91c1c",
  accentSoft: "#fef2f2",
  positive: "#047857",
  positiveStrong: "#065f46",
  positiveSoft: "#ecfdf5",
  positiveBorder: "#a7f3d0",
  negative: "#b42318",
  negativeSoft: "#fff1f2",
  negativeBorder: "#fecdd3",
  white: "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingHorizontal: 28,
    paddingBottom: 24,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 12,
    marginBottom: 16,
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 12,
  },
  logo: {
    width: 84,
    height: 84,
    objectFit: "contain",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  brandBlock: {
    maxWidth: "62%",
  },
  companyName: {
    fontSize: 15,
    fontWeight: 700,
    color: COLORS.text,
  },
  companyMeta: {
    fontSize: 8.5,
    color: COLORS.muted,
    marginTop: 4,
    lineHeight: 1.45,
  },
  badgeStack: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    maxWidth: "38%",
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 7.5,
    fontWeight: 700,
    color: COLORS.text,
  },
  badgeAccent: {
    borderColor: COLORS.accent,
    color: COLORS.accent,
  },
  protocolLine: {
    marginTop: 6,
  },
  title: {
    fontSize: 21,
    fontWeight: 700,
    marginTop: 14,
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 5,
    fontSize: 9.5,
    color: COLORS.muted,
    lineHeight: 1.5,
    maxWidth: "92%",
  },
  section: {
    marginBottom: 14,
  },
  sectionDense: {
    marginBottom: 9,
  },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: 700,
    color: COLORS.text,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  impactCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.positiveBorder,
    backgroundColor: COLORS.positiveSoft,
    padding: 16,
    marginBottom: 16,
  },
  impactLabel: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: COLORS.positive,
    marginBottom: 6,
  },
  impactValue: {
    fontSize: 28,
    fontWeight: 700,
    color: COLORS.positiveStrong,
  },
  impactText: {
    marginTop: 7,
    fontSize: 10,
    lineHeight: 1.55,
    color: "#3f3f46",
  },
  comparisonRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  comparisonCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 12,
  },
  comparisonCardNegative: {
    borderColor: COLORS.negativeBorder,
    backgroundColor: COLORS.negativeSoft,
  },
  comparisonCardPositive: {
    borderColor: COLORS.positiveBorder,
    backgroundColor: COLORS.positiveSoft,
  },
  comparisonCardAccent: {
    borderColor: COLORS.positiveBorder,
    backgroundColor: COLORS.positiveSoft,
  },
  comparisonLabel: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  comparisonValue: {
    fontSize: 15,
    fontWeight: 700,
    color: COLORS.text,
  },
  comparisonValueNegative: {
    color: COLORS.negative,
  },
  comparisonValuePositive: {
    color: COLORS.positiveStrong,
  },
  comparisonValueAccent: {
    color: COLORS.positiveStrong,
  },
  comparisonHint: {
    fontSize: 8,
    color: COLORS.muted,
    marginTop: 4,
    lineHeight: 1.4,
  },
  infoBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    backgroundColor: COLORS.white,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  infoItem: {
    width: "50%",
    paddingHorizontal: 6,
    marginBottom: 9,
  },
  infoItemFull: {
    width: "100%",
  },
  infoLabel: {
    fontSize: 7.5,
    color: COLORS.muted,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 9.5,
    fontWeight: 600,
    color: COLORS.text,
    lineHeight: 1.4,
  },
  compactTable: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    backgroundColor: COLORS.white,
  },
  compactHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.subtle,
  },
  compactHeaderCell: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 7.5,
    fontWeight: 700,
    color: "#52525b",
    textTransform: "uppercase",
  },
  compactHeaderCellDense: {
    paddingVertical: 5.5,
  },
  compactRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  compactCellLabel: {
    flex: 1.25,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 8.8,
    color: "#3f3f46",
  },
  compactCellDense: {
    paddingVertical: 5.5,
  },
  compactCellValue: {
    flex: 0.95,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 8.8,
    fontWeight: 700,
    color: COLORS.text,
    textAlign: "right",
  },
  opportunityCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    backgroundColor: COLORS.white,
    marginBottom: 14,
  },
  opportunityCardDense: {
    marginBottom: 8,
  },
  opportunityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  opportunityRowDense: {
    paddingVertical: 5.5,
  },
  opportunityFirstRow: {
    borderTopWidth: 0,
  },
  opportunityRowPositive: {
    backgroundColor: COLORS.positiveSoft,
  },
  opportunityLabel: {
    flex: 1,
    fontSize: 8.8,
    color: "#3f3f46",
    lineHeight: 1.45,
  },
  opportunityLabelPositive: {
    color: COLORS.positiveStrong,
    fontWeight: 600,
  },
  opportunityValue: {
    width: 124,
    fontSize: 9.2,
    fontWeight: 700,
    color: COLORS.text,
    textAlign: "right",
  },
  opportunityValuePositive: {
    color: COLORS.positiveStrong,
  },
  scenarioBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    backgroundColor: COLORS.white,
  },
  scenarioRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  scenarioFirstRow: {
    borderTopWidth: 0,
  },
  scenarioLabel: {
    flex: 1,
    fontSize: 8.8,
    color: "#3f3f46",
    lineHeight: 1.4,
  },
  scenarioValue: {
    width: 124,
    fontSize: 9.2,
    fontWeight: 700,
    color: COLORS.accent,
    textAlign: "right",
  },
  nextStepBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    padding: 14,
    marginTop: 2,
  },
  nextStepBoxDense: {
    padding: 11,
  },
  guaranteeBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.subtle,
    padding: 14,
    marginTop: 12,
  },
  guaranteePageStart: {
    marginTop: 0,
  },
  guaranteeTitle: {
    fontSize: 10.2,
    fontWeight: 700,
    color: COLORS.text,
    marginBottom: 6,
  },
  guaranteeLead: {
    fontSize: 9.1,
    fontWeight: 600,
    color: "#3f3f46",
    lineHeight: 1.55,
    marginBottom: 7,
  },
  guaranteeClauseLabel: {
    fontSize: 8.2,
    fontWeight: 700,
    color: COLORS.accent,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  guaranteeClause: {
    fontSize: 8.5,
    color: "#52525b",
    lineHeight: 1.55,
  },
  nextStepTitle: {
    fontSize: 10.5,
    fontWeight: 700,
    color: COLORS.text,
    marginBottom: 7,
  },
  nextStepTitleDense: {
    marginBottom: 5,
  },
  paragraph: {
    fontSize: 9.3,
    color: "#3f3f46",
    lineHeight: 1.6,
    marginBottom: 7,
  },
  paragraphDense: {
    fontSize: 8.8,
    lineHeight: 1.4,
    marginBottom: 5,
  },
  cta: {
    fontSize: 9.3,
    fontWeight: 700,
    color: COLORS.accent,
    marginTop: 3,
  },
  ctaDense: {
    fontSize: 8.8,
    marginTop: 2,
  },
  footer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  disclaimer: {
    fontSize: 8,
    color: COLORS.muted,
    lineHeight: 1.5,
  },
  footerMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  footerText: {
    fontSize: 7.8,
    color: COLORS.muted,
  },
  footerContacts: {
    marginTop: 8,
    gap: 3,
    alignItems: "center",
  },
  footerContactText: {
    fontSize: 7.8,
    color: COLORS.muted,
    textAlign: "center",
  },
  footerAddressText: {
    fontSize: 7.8,
    color: COLORS.muted,
    textAlign: "center",
    fontWeight: 700,
  },
});

function displayText(value: string | null | undefined, fallback = "Não informado") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function isFilledDisplayValue(value: string | null | undefined) {
  const normalized = value
    ?.trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return Boolean(
    normalized &&
      normalized !== "nao informado" &&
      normalized !== "não informado" &&
      normalized !== "em branco" &&
      normalized !== "-",
  );
}

function optionalText(value: string | null | undefined) {
  return isFilledDisplayValue(value) ? value?.trim() ?? null : null;
}

function optionalTextLimited(
  value: string | null | undefined,
  maxLength: number,
) {
  const text = optionalText(value);

  if (!text || text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function displayDate(value: string | null | undefined) {
  const result = formatCalculationDate(value);
  return result === "Não informado" ? "Não informado" : result;
}

function optionalDate(value: string | null | undefined) {
  const result = displayDate(value);
  return isFilledDisplayValue(result) ? result : null;
}

function displayCurrency(value: number | string | null | undefined) {
  const result = formatCalculationCurrency(value);
  return result === "Não informado" ? "Não informado" : result;
}

function optionalCurrency(value: number | string | null | undefined) {
  const result = displayCurrency(value);
  return isFilledDisplayValue(result) ? result : null;
}

function displayPhone(value: string | null | undefined) {
  const formatted = formatPhone(value);
  return formatted || "Não informado";
}

function optionalPhone(value: string | null | undefined) {
  const result = displayPhone(value);
  return isFilledDisplayValue(result) ? result : null;
}

function displayInt(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Não informado";
  }

  return String(value);
}

function optionalInt(value: number | string | null | undefined) {
  const result = displayInt(value);
  return isFilledDisplayValue(result) ? result : null;
}

function optionalCpf(value: string | null | undefined) {
  const result = formatCpfDigits(value);
  return isFilledDisplayValue(result) ? result : null;
}

function displayCompanyCnpj(value: string | null | undefined) {
  const formatted = formatCnpj(value);
  return formatted || null;
}

function displayWebsite(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/g, "");
}


function PdfBadge({
  label,
  accent = false,
}: {
  label: string;
  accent?: boolean;
}) {
  return (
    <Text style={accent ? [styles.badge, styles.badgeAccent] : styles.badge}>
      {label}
    </Text>
  );
}

function InfoItem({
  label,
  value,
  full = false,
}: {
  label: string;
  value: string | null;
  full?: boolean;
}) {
  if (!isFilledDisplayValue(value)) {
    return null;
  }

  return (
    <View style={full ? [styles.infoItem, styles.infoItemFull] : styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function DataTable({
  rows,
  dense = false,
}: {
  rows: Array<{ label: string; value: string | null }>;
  dense?: boolean;
}) {
  const visibleRows = rows.filter(
    (row): row is { label: string; value: string } => isFilledDisplayValue(row.value),
  );

  if (!visibleRows.length) {
    return null;
  }

  return (
    <View style={styles.compactTable}>
      <View style={styles.compactHeader}>
        <Text
          style={
            dense
              ? [styles.compactHeaderCell, styles.compactHeaderCellDense]
              : styles.compactHeaderCell
          }
        >
          Indicador
        </Text>
        <Text
          style={
            dense
              ? [styles.compactHeaderCell, styles.compactHeaderCellDense]
              : styles.compactHeaderCell
          }
        >
          Valor
        </Text>
      </View>
      {visibleRows.map((row) => (
        <View key={row.label} style={styles.compactRow} wrap={false}>
          <Text
            style={
              dense
                ? [styles.compactCellLabel, styles.compactCellDense]
                : styles.compactCellLabel
            }
          >
            {row.label}
          </Text>
          <Text
            style={
              dense
                ? [styles.compactCellValue, styles.compactCellDense]
                : styles.compactCellValue
            }
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

type OpportunityTone = "default" | "positive";

function OpportunityTable({
  rows,
  dense = false,
}: {
  rows: Array<{ label: string; value: string | null; tone?: OpportunityTone }>;
  dense?: boolean;
}) {
  const visibleRows = rows.filter(
    (row): row is { label: string; value: string; tone?: OpportunityTone } =>
      isFilledDisplayValue(row.value),
  );

  if (!visibleRows.length) {
    return null;
  }

  return (
    <View
      style={
        dense
          ? [styles.opportunityCard, styles.opportunityCardDense]
          : styles.opportunityCard
      }
    >
      {visibleRows.map((row, index) => {
        const tone = row.tone ?? "default";
        const toneRowStyles =
          tone === "positive"
            ? index === 0
              ? [
                  styles.opportunityRow,
                  styles.opportunityFirstRow,
                  styles.opportunityRowPositive,
                ]
              : [styles.opportunityRow, styles.opportunityRowPositive]
            : index === 0
              ? [styles.opportunityRow, styles.opportunityFirstRow]
              : [styles.opportunityRow];
        const rowStyles = dense
          ? [...toneRowStyles, styles.opportunityRowDense]
          : toneRowStyles;
        const labelStyles =
          tone === "positive"
            ? [styles.opportunityLabel, styles.opportunityLabelPositive]
            : [styles.opportunityLabel];
        const valueStyles =
          tone === "positive"
            ? [styles.opportunityValue, styles.opportunityValuePositive]
            : [styles.opportunityValue];

        return (
          <View key={row.label} style={rowStyles} wrap={false}>
            <Text style={labelStyles}>{row.label}</Text>
            <Text style={valueStyles}>{row.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function CalculationReportPdf({
  calculation,
  companyName,
  companyDocument,
  companyLogoSrc,
  protocolNumber,
  companyPhone,
  companyWebsite,
  companyAddress,
  simulationGuarantee,
}: {
  calculation: FinancingCalculation;
  companyName: string;
  companyDocument?: string | null;
  companyLogoSrc?: string | null;
  protocolNumber?: string | null;
  companyPhone?: string | null;
  companyWebsite?: string | null;
  companyAddress?: string | null;
  simulationGuarantee?: {
    title?: string | null;
    lead?: string | null;
    clauseLabel?: string | null;
    clauseText?: string | null;
  } | null;
}): React.ReactElement<DocumentProps> {
  const issueDate = displayDate(new Date().toISOString().slice(0, 10));
  const specialist = displayText(calculation.specialist_name || "A definir");
  const attendanceDate = displayDate(
    calculation.attendance_date ?? new Date().toISOString().slice(0, 10),
  );
  const situation = displayText(calculation.situation || "Aprovado");
  const expiresIn = optionalDate(calculation.expires_in);
  const monthlyReduction = optionalCurrency(
    calculation.abusive_interest_per_installment,
  );
  const isVehicleSimulation = calculation.simulation_type === "veiculo";
  const isImovelSimulation = calculation.simulation_type === "imovel";

  const paidInstallmentsNum =
    calculation.paid_installments !== null && calculation.paid_installments !== undefined
      ? Number(calculation.paid_installments)
      : null;

  const totalInsurancePaid =
    isImovelSimulation &&
    paidInstallmentsNum !== null &&
    !Number.isNaN(paidInstallmentsNum) &&
    calculation.insurance_value !== null &&
    calculation.insurance_value !== undefined
      ? paidInstallmentsNum * Number(calculation.insurance_value)
      : null;

  const totalAdminFeePaid =
    isImovelSimulation &&
    paidInstallmentsNum !== null &&
    !Number.isNaN(paidInstallmentsNum) &&
    calculation.administrative_fee !== null &&
    calculation.administrative_fee !== undefined
      ? paidInstallmentsNum * Number(calculation.administrative_fee)
      : null;
  const companyCnpj = displayCompanyCnpj(companyDocument);
  const protocol = optionalText(protocolNumber);
  const impactSavings = optionalCurrency(calculation.estimated_savings);
  const currentInstallment = optionalCurrency(calculation.current_installment_value);
  const correctedInstallment = optionalCurrency(calculation.corrected_installment_value);
  const comparisonCards = [
    {
      label: "Parcela atual",
      value: currentInstallment,
      cardStyle: [styles.comparisonCard, styles.comparisonCardNegative],
      valueStyle: [styles.comparisonValue, styles.comparisonValueNegative],
    },
    {
      label: "Parcela corrigida",
      value: correctedInstallment,
      cardStyle: [styles.comparisonCard, styles.comparisonCardAccent],
      valueStyle: [styles.comparisonValue, styles.comparisonValueAccent],
    },
    {
      label: "Economia mensal",
      value: monthlyReduction,
      cardStyle: [styles.comparisonCard, styles.comparisonCardPositive],
      valueStyle: [styles.comparisonValue, styles.comparisonValuePositive],
      hint: "Estimativa inicial com base no cenário informado.",
    },
  ].filter((card) => isFilledDisplayValue(card.value));

  const operationRows = [
    { label: "Valor à vista", value: optionalCurrency(calculation.cash_value) },
    ...(isVehicleSimulation
      ? [{ label: "Entrada", value: optionalCurrency(calculation.down_payment) }]
      : []),
    {
      label: "Valor financiado",
      value: optionalCurrency(calculation.financed_value),
    },
    {
      label: "Quantidade de parcelas",
      value: optionalInt(calculation.installment_count),
    },
    {
      label: "Valor atual da parcela",
      value: currentInstallment,
    },
    ...(isImovelSimulation && calculation.administrative_fee !== null && calculation.administrative_fee !== undefined
      ? [{ label: "Tarifa administrativa (por parcela)", value: optionalCurrency(calculation.administrative_fee) }]
      : []),
    ...(isImovelSimulation && calculation.insurance_value !== null && calculation.insurance_value !== undefined
      ? [{ label: "Seguros (por parcela)", value: optionalCurrency(calculation.insurance_value) }]
      : []),
    {
      label: "Parcelas pagas",
      value: optionalInt(calculation.paid_installments),
    },
    {
      label: "Parcelas a pagar",
      value: optionalInt(calculation.remaining_installments),
    },
  ];

  const opportunityRows = [
    {
      label: "Economia mensal",
      value: monthlyReduction,
      tone: "positive" as const,
    },
    {
      label: "Total da dívida atual",
      value: optionalCurrency(calculation.current_total_financing),
    },
    {
      label: "Total da dívida após revisão",
      value: optionalCurrency(calculation.corrected_total_financing),
    },
    {
      label: "Economia total",
      value: impactSavings,
      tone: "positive" as const,
    },
    {
      label: "Juros abusivos já pagos",
      value: optionalCurrency(calculation.abusive_interest_paid),
      tone: "positive" as const,
    },
    {
      label: "Parcela com abatimento de juros abusivos já pagos",
      value: optionalCurrency(calculation.installment_reduction_remaining),
      tone: "positive" as const,
    },
    {
      label: "Total pago até o momento",
      value: optionalCurrency(calculation.paid_amount_until_now),
    },
    {
      label: "Total de seguros pagos (até o momento)",
      value: optionalCurrency(totalInsurancePaid),
    },
    {
      label: "Total de tarifas pagas (até o momento)",
      value: optionalCurrency(totalAdminFeePaid),
    },
    {
      label: "Saldo devedor sem correção",
      value: optionalCurrency(calculation.remaining_amount_to_pay),
    },
    {
      label: "Saldo devedor pós-correção",
      value: optionalCurrency(calculation.real_debt),
    },
    ...(calculation.settlement_discount_percentage !== null &&
    calculation.settlement_discount_percentage !== undefined &&
    calculation.settlement_amount !== null &&
    calculation.settlement_amount !== undefined
      ? [
          {
            label: "Valor para quitação",
            value: optionalCurrency(calculation.settlement_amount),
            tone: "positive" as const,
          },
        ]
      : []),
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {companyLogoSrc ? (
            <View style={styles.logoWrap}>
              <Image src={companyLogoSrc} style={styles.logo} />
            </View>
          ) : null}
          <View style={styles.headerTop}>
            <View style={styles.brandBlock}>
              <Text style={styles.companyName}>{displayText(companyName, "CRM")}</Text>
              {companyCnpj ? (
                <Text style={styles.companyMeta}>{`CNPJ: ${companyCnpj}`}</Text>
              ) : null}
              <Text style={styles.companyMeta}>Data de emissão: {issueDate}</Text>
              {protocol ? (
                <Text style={[styles.companyMeta, styles.protocolLine]}>
                  {`Protocolo: ${protocol}`}
                </Text>
              ) : null}
            </View>
            <View style={styles.badgeStack}>
              <PdfBadge label="SIMULAÇÃO GRATUITA" accent />
              <PdfBadge label="ANÁLISE INICIAL" />
              <PdfBadge label="ESTIMATIVA" />
            </View>
          </View>
          <Text style={styles.title}>ANÁLISE SINTETIZADA</Text>
          <Text style={styles.subtitle}>
            Simulação inicial de potencial revisional.
          </Text>
          <Text style={styles.subtitle}>
            Esta análise apresenta uma visão inicial do potencial de redução
            identificado a partir dos dados informados. O objetivo é demonstrar,
            de forma clara e objetiva, onde pode existir oportunidade de revisão
            e negociação do contrato.
          </Text>
        </View>

        {impactSavings ? (
          <View style={styles.impactCard}>
            <Text style={styles.impactLabel}>ECONOMIA TOTAL</Text>
            <Text style={styles.impactValue}>{impactSavings}</Text>
            <Text style={styles.impactText}>
              Com base nos dados informados, identificamos um potencial relevante
              de redução no custo total do contrato.
            </Text>
          </View>
        ) : null}

        {comparisonCards.length ? (
          <View style={styles.comparisonRow}>
            {comparisonCards.map((card) => (
              <View key={card.label} style={card.cardStyle}>
                <Text style={styles.comparisonLabel}>{card.label}</Text>
                <Text style={card.valueStyle}>{card.value}</Text>
                {card.hint ? (
                  <Text style={styles.comparisonHint}>{card.hint}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados do atendimento</Text>
          <View style={styles.infoBox}>
            <View style={styles.infoGrid}>
              <InfoItem label="Cliente" value={optionalText(calculation.client_name)} />
              <InfoItem label="CPF" value={optionalCpf(calculation.client_cpf)} />
              <InfoItem
                label="Telefone"
                value={optionalPhone(calculation.client_phone)}
              />
              <InfoItem
                label="Financeira"
                value={optionalText(calculation.financial_institution)}
              />
              <InfoItem
                label="Tipo da simulação"
                value={
                  calculation.simulation_type
                    ? formatPreSaleType(calculation.simulation_type)
                    : null
                }
              />
              <InfoItem
                label="Especialista responsável"
                value={specialist}
              />
              <InfoItem
                label="Data do atendimento"
                value={attendanceDate}
              />
              <InfoItem
                label="Situação"
                value={situation}
              />
              <InfoItem
                label="Proposta válida até:"
                value={expiresIn}
              />
              {isVehicleSimulation ? (
                <InfoItem
                  label="Modelo e marca"
                  value={optionalText(calculation.vehicle)}
                />
              ) : null}
              {isVehicleSimulation ? (
                <InfoItem
                  label="Ano"
                  value={optionalText(calculation.vehicle_year)}
                />
              ) : null}
              <InfoItem
                label="Observações"
                value={optionalTextLimited(calculation.notes, 240)}
                full
              />
            </View>
          </View>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View
          style={
            isImovelSimulation
              ? [styles.section, styles.sectionDense]
              : styles.section
          }
          wrap={false}
        >
          <Text style={styles.sectionTitle}>Resumo da operação atual</Text>
          <DataTable rows={operationRows} dense={isImovelSimulation} />
        </View>

        <View
          style={
            isImovelSimulation
              ? [styles.section, styles.sectionDense]
              : styles.section
          }
        >
          <Text style={styles.sectionTitle}>Panorama da oportunidade</Text>
          <OpportunityTable rows={opportunityRows} dense={isImovelSimulation} />
        </View>

        <View
          style={
            isImovelSimulation
              ? [styles.nextStepBox, styles.nextStepBoxDense]
              : styles.nextStepBox
          }
        >
          <Text
            style={
              isImovelSimulation
                ? [styles.nextStepTitle, styles.nextStepTitleDense]
                : styles.nextStepTitle
            }
          >
            Como esta análise pode ajudar você
          </Text>
          <Text
            style={
              isImovelSimulation
                ? [styles.paragraph, styles.paragraphDense]
                : styles.paragraph
            }
          >
            A partir desta simulação, nossa equipe pode avaliar a documentação e
            indicar o caminho mais adequado para buscar uma condição mais
            vantajosa, com segurança e estratégia.
          </Text>
          <Text
            style={
              isImovelSimulation
                ? [styles.nextStepTitle, styles.nextStepTitleDense]
                : styles.nextStepTitle
            }
          >
            Próximo passo recomendado
          </Text>
          <Text
            style={
              isImovelSimulation
                ? [styles.paragraph, styles.paragraphDense]
                : styles.paragraph
            }
          >
            Para avançarmos com segurança, o próximo passo é validar a
            documentação do contrato e definir a estratégia mais adequada para
            buscar a melhor condição possível junto à instituição financeira.
          </Text>
          <Text
            style={
              isImovelSimulation ? [styles.cta, styles.ctaDense] : styles.cta
            }
          >
            Fale com seu consultor para validar os documentos e avançar para a
            próxima etapa.
          </Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View
          style={[styles.guaranteeBox, styles.guaranteePageStart]}
          wrap={false}
        >
          <Text style={styles.guaranteeTitle}>
            {displayText(simulationGuarantee?.title, "Segurança contratual")}
          </Text>
          <Text style={styles.guaranteeLead}>
            {displayText(
              simulationGuarantee?.lead,
              "A prestação de serviço segue as condições definidas no contrato assinado entre as partes, com análise documental e orientação de próximos passos conforme o caso.",
            )}
          </Text>
          {isFilledDisplayValue(simulationGuarantee?.clauseText) ? (
            <>
              <Text style={styles.guaranteeClauseLabel}>
                {displayText(simulationGuarantee?.clauseLabel, "Condição contratual")}
              </Text>
              <Text style={styles.guaranteeClause}>
                {simulationGuarantee?.clauseText}
              </Text>
            </>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.disclaimer}>
            Esta simulação possui caráter comercial e estimativo. Os valores
            apresentados são baseados nos dados fornecidos e em parâmetros médios
            de análise revisional. O resultado final depende da análise
            documental, estratégia aplicada e condições da instituição
            financeira.
          </Text>
          <View style={styles.footerMeta}>
            <Text style={styles.footerText}>Emitido em {issueDate}</Text>
            <Text style={styles.footerText}>{displayText(companyName, "CRM")}</Text>
          </View>
          <View style={styles.footerContacts}>
            {optionalText(companyAddress) ? (
              <Text style={styles.footerAddressText}>{optionalText(companyAddress)}</Text>
            ) : null}
            {optionalPhone(companyPhone) ? (
              <Text style={styles.footerContactText}>{optionalPhone(companyPhone)}</Text>
            ) : null}
            {displayWebsite(companyWebsite) ? (
              <Text style={styles.footerContactText}>{displayWebsite(companyWebsite)}</Text>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}
