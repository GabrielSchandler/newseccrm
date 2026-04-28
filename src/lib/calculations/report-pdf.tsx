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
    paddingTop: 32,
    paddingHorizontal: 32,
    paddingBottom: 28,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingBottom: 14,
    marginBottom: 18,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  companyName: {
    fontSize: 15,
    fontWeight: 700,
    color: "#111827",
  },
  companyMeta: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 4,
    lineHeight: 1.4,
  },
  badge: {
    borderWidth: 1,
    borderColor: "#111827",
    color: "#111827",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 21,
    fontWeight: 700,
    color: "#111827",
    marginTop: 16,
  },
  subtitle: {
    fontSize: 10,
    color: "#4b5563",
    marginTop: 6,
    lineHeight: 1.5,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 10,
    color: "#111827",
    textTransform: "uppercase",
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
    fontSize: 8,
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  value: {
    fontSize: 11,
    fontWeight: 600,
  },
  executiveBox: {
    borderWidth: 1,
    borderColor: "#111827",
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
  },
  executiveLabel: {
    fontSize: 8,
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  executiveValue: {
    fontSize: 28,
    fontWeight: 700,
    color: "#111827",
  },
  executiveText: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.6,
    marginTop: 8,
  },
  gainGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  gainColumn: {
    flex: 1,
  },
  gainTitle: {
    fontSize: 9,
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  gainValue: {
    fontSize: 15,
    fontWeight: 700,
    color: "#111827",
  },
  table: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 14,
    backgroundColor: "#ffffff",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
  },
  row: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  headerCell: {
    flex: 1,
    padding: 9,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#4b5563",
  },
  cell: {
    flex: 1,
    padding: 9,
    fontSize: 9,
  },
  compactResultsTable: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 16,
  },
  compactResultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  compactResultFirstRow: {
    borderTopWidth: 0,
  },
  compactResultLabel: {
    fontSize: 9,
    color: "#4b5563",
    maxWidth: "68%",
    paddingRight: 12,
  },
  compactResultValue: {
    fontSize: 11,
    fontWeight: 700,
    color: "#111827",
  },
  simulationTable: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
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
    borderTopColor: "#e5e7eb",
  },
  simulationFirstRow: {
    borderTopWidth: 0,
  },
  simulationLabel: {
    fontSize: 9,
    color: "#4b5563",
    paddingRight: 12,
    maxWidth: "70%",
  },
  simulationValue: {
    fontSize: 10,
    fontWeight: 700,
    color: "#111827",
  },
  salesSection: {
    borderWidth: 1,
    borderColor: "#111827",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  salesTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 8,
  },
  salesParagraph: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.6,
    marginBottom: 8,
  },
  note: {
    fontSize: 9,
    color: "#6b7280",
    lineHeight: 1.5,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
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
    color: "#6b7280",
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
  const currentTotal = formatCalculationCurrency(calculation.current_total_financing);
  const correctedTotal = formatCalculationCurrency(
    calculation.corrected_total_financing,
  );
  const estimatedSavings = formatCalculationCurrency(calculation.estimated_savings);
  const remainingDebt = formatCalculationCurrency(calculation.remaining_amount_to_pay);
  const reducedInstallment = formatCalculationCurrency(
    calculation.installment_reduction_remaining,
  );
  const simulationRows = [
    [
      "Possivel saldo com reducao de 30%",
      formatCalculationCurrency(calculation.debt_after_30_discount),
    ],
    [
      "Cenario agressivo com reducao de 90%",
      formatCalculationCurrency(calculation.debt_after_90_discount),
    ],
    [
      "Exemplo de acordo com 50% em 15 parcelas",
      formatCalculationCurrency(calculation.example_50_discount_15x),
    ],
    [
      "Exemplo de acordo com 50% em 10 parcelas",
      formatCalculationCurrency(calculation.example_50_discount_10x),
    ],
    [
      "Exemplo de acordo com 50% em 5 parcelas",
      formatCalculationCurrency(calculation.example_50_discount_5x),
    ],
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
            Simulacao comercial inicial com foco no potencial de reducao do custo
            financeiro e melhoria das condicoes atuais do contrato.
          </Text>
        </View>

        <View style={styles.executiveBox}>
          <Text style={styles.executiveLabel}>Potencial de economia identificado</Text>
          <Text style={styles.executiveValue}>{estimatedSavings}</Text>
          <Text style={styles.executiveText}>
            A partir dos dados apresentados, identificamos uma oportunidade de
            revisao com potencial para reduzir o custo total do contrato e abrir
            espaco para uma negociacao mais vantajosa.
          </Text>
          <View style={styles.gainGrid}>
            <View style={styles.gainColumn}>
              <Text style={styles.gainTitle}>Parcela atual</Text>
              <Text style={styles.gainValue}>
                {formatCalculationCurrency(calculation.current_installment_value)}
              </Text>
            </View>
            <View style={styles.gainColumn}>
              <Text style={styles.gainTitle}>Parcela projetada</Text>
              <Text style={styles.gainValue}>{reducedInstallment}</Text>
            </View>
            <View style={styles.gainColumn}>
              <Text style={styles.gainTitle}>Saldo atual estimado</Text>
              <Text style={styles.gainValue}>{remainingDebt}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identificacao do atendimento</Text>
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

        <Text style={styles.sectionTitle}>Resumo da operacao atual</Text>
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

        <Text style={styles.sectionTitle}>Panorama da oportunidade</Text>
        <View style={styles.compactResultsTable}>
          {[
            ["Quanto o cliente paga hoje no total", currentTotal],
            ["Quanto deveria pagar desde o comeco", correctedTotal],
            ["Valor cobrado a maior", estimatedSavings],
            ["Valor atualmente para quitacao", remainingDebt],
            ["Reducao estimada da parcela", reducedInstallment],
            [
              "Juros abusivos ja pagos",
              formatCalculationCurrency(calculation.abusive_interest_paid),
            ],
          ].map(([label, value], index) => (
            <View
              key={label}
              style={
                index === 0
                  ? [styles.compactResultRow, styles.compactResultFirstRow]
                  : styles.compactResultRow
              }
            >
              <Text style={styles.compactResultLabel}>{label}</Text>
              <Text style={styles.compactResultValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cenarios de negociacao</Text>
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

        <View style={styles.salesSection}>
          <Text style={styles.salesTitle}>Como essa simulacao pode ajudar no fechamento</Text>
          <Text style={styles.salesParagraph}>
            Este material foi preparado para mostrar, de forma objetiva, o ganho
            financeiro que pode ser buscado com uma analise revisional adequada.
            O foco do nosso trabalho e transformar essa oportunidade em reducao
            real de custo, melhora da negociacao e alivio financeiro para o
            cliente.
          </Text>
          <Text style={styles.salesParagraph}>
            Com base nesta estimativa, o proximo passo comercial e avaliar a
            estrategia mais aderente ao caso para avancar com a revisao e buscar
            o melhor resultado pratico possivel.
          </Text>
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
