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
    padding: 32,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  brand: {
    fontSize: 10,
    color: "#0f766e",
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 10,
    color: "#475569",
    marginBottom: 18,
    lineHeight: 1.5,
  },
  section: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 10,
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
    borderColor: "#cbd5e1",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
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
    borderRadius: 6,
    padding: 12,
  },
  highlightValue: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 6,
  },
  note: {
    fontSize: 9,
    color: "#475569",
    lineHeight: 1.5,
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
}: {
  calculation: FinancingCalculation;
}): React.ReactElement<DocumentProps> {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>GRS CRM</Text>
        <Text style={styles.title}>ANALISE SINTETIZADA</Text>
        <Text style={styles.subtitle}>
          Relatorio revisional simplificado para apoio comercial e demonstracao
          de economia estimada ao cliente.
        </Text>

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
              value={formatCalculationDate(calculation.service_date)}
            />
            <PdfItem
              label="Financeira"
              value={calculation.financer_name ?? "Nao informado"}
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
              value={formatCalculationDate(calculation.expires_at)}
            />
            <PdfItem
              label="Veiculo"
              value={calculation.vehicle ?? "Nao informado"}
            />
            <PdfItem
              label="Ano"
              value={calculation.vehicle_year ?? "Nao informado"}
            />
            <PdfItem
              label="Observacoes"
              value={calculation.observations ?? "Nao informado"}
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
          {[
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
              formatCalculationCurrency(
                calculation.installment_reduction_remaining,
              ),
            ],
            [
              "Juros abusivos ja pagos",
              formatCalculationCurrency(calculation.abusive_interest_paid),
            ],
          ].map(([label, value]) => (
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
          <View style={styles.grid}>
            <PdfItem
              label="Reducao de 30%"
              value={formatCalculationCurrency(calculation.debt_after_30_discount)}
            />
            <PdfItem
              label="Reducao de 90%"
              value={formatCalculationCurrency(calculation.debt_after_90_discount)}
            />
            <PdfItem
              label="50% de abatimento em 15x"
              value={formatCalculationCurrency(
                calculation.example_50_discount_15x,
              )}
            />
            <PdfItem
              label="50% de abatimento em 10x"
              value={formatCalculationCurrency(
                calculation.example_50_discount_10x,
              )}
            />
            <PdfItem
              label="50% de abatimento em 5x"
              value={formatCalculationCurrency(
                calculation.example_50_discount_5x,
              )}
            />
          </View>
        </View>

        <Text style={styles.note}>
          Todos os valores informados neste calculo foram baseados em taxas medias
          utilizadas pelo mercado na categoria de financiamentos bancarios. Os
          verdadeiros valores serao revogados e decididos posteriormente a
          prestacao de servicos.
        </Text>
      </Page>
    </Document>
  );
}
