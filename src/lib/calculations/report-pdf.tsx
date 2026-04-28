import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { FinancingCalculation } from "@/types/calculation";
import {
  formatCalculationCurrency,
  formatCalculationDate,
  formatCpfDigits,
} from "@/lib/calculations/formatters";

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 24,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  header: {
    backgroundColor: "#0f766e",
    borderRadius: 10,
    padding: 18,
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 700,
    color: "#ffffff",
  },
  companyMeta: {
    fontSize: 10,
    color: "#ccfbf1",
    marginTop: 4,
    lineHeight: 1.5,
  },
  badge: {
    backgroundColor: "#ccfbf1",
    color: "#115e59",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#ffffff",
    marginTop: 14,
  },
  subtitle: {
    fontSize: 10,
    color: "#e6fffb",
    marginTop: 6,
    lineHeight: 1.5,
  },
  summaryStrip: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    padding: 10,
  },
  summaryLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    color: "#64748b",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
  },
  section: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    backgroundColor: "#ffffff",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 10,
    color: "#0f172a",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  item: {
    width: "50%",
    paddingHorizontal: 6,
    marginBottom: 10,
  },
  fullItem: {
    width: "100%",
  },
  label: {
    fontSize: 9,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  value: {
    fontSize: 11,
    fontWeight: 600,
  },
  table: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 14,
    backgroundColor: "#ffffff",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
  },
  row: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  headerCell: {
    flex: 1,
    padding: 10,
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#475569",
  },
  cell: {
    flex: 1,
    padding: 10,
    fontSize: 10,
  },
  highlightWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  highlight: {
    width: "50%",
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  highlightBox: {
    borderWidth: 1,
    borderColor: "#99f6e4",
    backgroundColor: "#f0fdfa",
    borderRadius: 10,
    padding: 12,
  },
  highlightValue: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 6,
  },
  simulationTable: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  simulationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  simulationFirstRow: {
    borderTopWidth: 0,
  },
  simulationLabel: {
    fontSize: 10,
    color: "#334155",
    paddingRight: 12,
    maxWidth: "70%",
  },
  simulationValue: {
    fontSize: 11,
    fontWeight: 700,
    color: "#0f172a",
  },
  note: {
    fontSize: 9,
    color: "#475569",
    lineHeight: 1.5,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 12,
    marginTop: 2,
  },
  footer: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: "#64748b",
  },
});

function PdfItem({
  label,
  value,
  full = false,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  const itemStyles = full ? [styles.item, styles.fullItem] : [styles.item];

  return (
    <View style={itemStyles}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function CalculationReportPdf({
  calculation,
  companyName,
  companyDocument,
}: {
  calculation: FinancingCalculation;
  companyName: string;
  companyDocument?: string | null;
}): React.ReactElement<DocumentProps> {
  const highlights = [
    [
      "Quanto o cliente paga hoje no total",
      formatCalculationCurrency(calculation.current_total_financing),
    ],
    [
      "Quanto deveria pagar desde o comeco",
      formatCalculationCurrency(calculation.corrected_total_financing),
    ],
    [
      "Valor cobrado a maior",
      formatCalculationCurrency(calculation.estimated_savings),
    ],
    [
      "Valor atualmente para quitacao",
      formatCalculationCurrency(calculation.remaining_amount_to_pay),
    ],
    [
      "Reducao estimada da parcela",
      formatCalculationCurrency(calculation.installment_reduction_remaining),
    ],
    [
      "Juros abusivos ja pagos",
      formatCalculationCurrency(calculation.abusive_interest_paid),
    ],
  ];
  const simulationRows = [
    ["Reducao de 30% sobre o saldo", formatCalculationCurrency(calculation.debt_after_30_discount)],
    ["Reducao de 90% sobre o saldo", formatCalculationCurrency(calculation.debt_after_90_discount)],
    ["50% de abatimento em 15 parcelas", formatCalculationCurrency(calculation.example_50_discount_15x)],
    ["50% de abatimento em 10 parcelas", formatCalculationCurrency(calculation.example_50_discount_10x)],
    ["50% de abatimento em 5 parcelas", formatCalculationCurrency(calculation.example_50_discount_5x)],
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.companyName}>{companyName}</Text>
              <Text style={styles.companyMeta}>
                {companyDocument ? `Documento: ${companyDocument}` : "Simulacao gratuita de analise revisional"}
              </Text>
            </View>
            <Text style={styles.badge}>Simulacao gratuita</Text>
          </View>
          <Text style={styles.title}>ANALISE SINTETIZADA</Text>
          <Text style={styles.subtitle}>
            Documento demonstrativo com estimativa revisional para apresentacao
            comercial ao cliente.
          </Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Cliente</Text>
              <Text style={styles.summaryValue}>{calculation.client_name}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Economia estimada</Text>
              <Text style={styles.summaryValue}>
                {formatCalculationCurrency(calculation.estimated_savings)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Parcela atual</Text>
              <Text style={styles.summaryValue}>
                {formatCalculationCurrency(calculation.current_installment_value)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados do cliente</Text>
          <View style={styles.grid}>
            <PdfItem label="Cliente" value={calculation.client_name} />
            <PdfItem
              label="CPF"
              value={formatCpfDigits(calculation.client_cpf)}
            />
            <PdfItem
              label="Telefone"
              value={calculation.client_phone ?? "Nao informado"}
            />
            <PdfItem
              label="Data de atendimento"
              value={formatCalculationDate(calculation.attendance_date)}
            />
            <PdfItem
              label="Financeira"
              value={calculation.financial_institution ?? "Nao informado"}
            />
            <PdfItem
              label="Especialista"
              value={calculation.specialist_name ?? "Nao informado"}
            />
            <PdfItem
              label="Situacao"
              value={calculation.situation ?? "Nao informado"}
            />
            <PdfItem
              label="Expira em"
              value={formatCalculationDate(calculation.expires_in)}
            />
            <PdfItem
              label="Ano"
              value={calculation.vehicle_year ?? "Nao informado"}
            />
            <PdfItem
              label="Observacoes"
              value={calculation.notes ?? "Nao informado"}
              full
            />
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.headerCell}>Item</Text>
            <Text style={styles.headerCell}>Valor</Text>
          </View>
          {[
            ["Valor a vista", formatCalculationCurrency(calculation.cash_value)],
            ["Entrada", formatCalculationCurrency(calculation.down_payment)],
            [
              "Valor financiado",
              formatCalculationCurrency(calculation.financed_value),
            ],
            [
              "Quantidade de parcelas",
              String(calculation.installment_count ?? "Nao informado"),
            ],
            [
              "Valor atual da parcela",
              formatCalculationCurrency(calculation.current_installment_value),
            ],
            [
              "Parcelas pagas",
              String(calculation.paid_installments ?? "Nao informado"),
            ],
            [
              "Parcelas a pagar",
              String(calculation.remaining_installments ?? "Nao informado"),
            ],
          ].map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.cell}>{label}</Text>
              <Text style={styles.cell}>{value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Resultado do calculo</Text>
        <View style={styles.highlightWrap}>
          {highlights.map(([label, value]) => (
            <View key={label} style={styles.highlight}>
              <View style={styles.highlightBox}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.highlightValue}>{value}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Simulacao simplificada</Text>
          <View style={styles.simulationTable}>
            {simulationRows.map(([label, value], index) => (
              <View
                key={label}
                style={index === 0
                  ? [styles.simulationRow, styles.simulationFirstRow]
                  : styles.simulationRow}
              >
                <Text style={styles.simulationLabel}>{label}</Text>
                <Text style={styles.simulationValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.note}>
          Todos os valores informados neste calculo foram baseados em taxas medias
          utilizadas pelo mercado na categoria de financiamentos bancarios. Os
          verdadeiros valores serao revogados e decididos posteriormente a
          prestacao de servicos.
        </Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Documento emitido em {formatCalculationDate(new Date().toISOString().slice(0, 10))}
          </Text>
          <Text style={styles.footerText}>{companyName}</Text>
        </View>
      </Page>
    </Document>
  );
}
