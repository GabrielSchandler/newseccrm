import sharp from "sharp";
import type { FinancingCalculation } from "@/types/calculation";

const WIDTH = 1080;
const HEIGHT = 1350;

type SummaryImageProps = {
  calculation: FinancingCalculation;
  companyName: string;
  companyLogoSrc?: string | null;
  protocolNumber?: string | null;
  companyPhone?: string | null;
  companyWebsite?: string | null;
  companyAddress?: string | null;
};

type SummaryRow = {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
});

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maxLength - 1, 1)).trimEnd()}…`;
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = value.trim().replace(/\s/g, "");
  const parsed = Number(normalized);

  if (Number.isFinite(parsed)) {
    return parsed;
  }

  const brazilianParsed = Number(
    normalized.replace(/\./g, "").replace(",", "."),
  );

  return Number.isFinite(brazilianParsed) ? brazilianParsed : null;
}

function formatMoney(value: number | string | null | undefined) {
  const numericValue = toNumber(value);
  return numericValue === null ? null : moneyFormatter.format(numericValue);
}

function formatInteger(value: number | string | null | undefined) {
  const numericValue = toNumber(value);
  return numericValue === null ? null : String(Math.max(Math.trunc(numericValue), 0));
}

function optionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function getCompanyInitials(companyName: string) {
  const words = companyName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "CRM";
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

function formatSimulationType(value: FinancingCalculation["simulation_type"]) {
  if (value === "veiculo") {
    return "Financiamento de veículo";
  }

  if (value === "imovel") {
    return "Financiamento imobiliário";
  }

  if (value === "emprestimo") {
    return "Empréstimo";
  }

  return "Análise financeira";
}

function resolveModel(calculation: FinancingCalculation) {
  if (calculation.simulation_type !== "veiculo") {
    return null;
  }

  return [optionalText(calculation.vehicle), optionalText(calculation.vehicle_year)]
    .filter(Boolean)
    .join(" • ") || null;
}

function rowColor(tone: SummaryRow["tone"]) {
  if (tone === "positive") {
    return "#087A55";
  }

  if (tone === "negative") {
    return "#B42318";
  }

  return "#111827";
}

function renderRows(rows: SummaryRow[], x: number, startY: number) {
  return rows
    .slice(0, 7)
    .map((row, index) => {
      const y = startY + index * 48;
      const color = rowColor(row.tone);

      return `
        <g>
          <text x="${x}" y="${y}" class="row-label">${escapeXml(
            truncate(row.label, 35),
          )}</text>
          <text x="${x + 406}" y="${y}" text-anchor="end" class="row-value" fill="${color}">${escapeXml(
            truncate(row.value, 27),
          )}</text>
          <line x1="${x}" y1="${y + 17}" x2="${x + 406}" y2="${y + 17}" stroke="#E5E7EB" stroke-width="1" />
        </g>
      `;
    })
    .join("");
}

function renderMetricCard({
  x,
  label,
  value,
  color,
  background,
}: {
  x: number;
  label: string;
  value: string;
  color: string;
  background: string;
}) {
  return `
    <g>
      <rect x="${x}" y="445" width="306" height="148" rx="12" fill="${background}" stroke="${color}" stroke-opacity="0.24" />
      <rect x="${x}" y="445" width="7" height="148" rx="3.5" fill="${color}" />
      <text x="${x + 28}" y="490" class="metric-label">${escapeXml(label)}</text>
      <text x="${x + 28}" y="542" class="metric-value" fill="${color}">${escapeXml(
        truncate(value, 21),
      )}</text>
      <text x="${x + 28}" y="570" class="metric-caption">Valor mensal estimado</text>
    </g>
  `;
}

function buildSummarySvg({
  calculation,
  companyName,
  companyLogoSrc,
  protocolNumber,
  companyPhone,
  companyWebsite,
  companyAddress,
}: SummaryImageProps) {
  const currentInstallment = formatMoney(calculation.current_installment_value) ?? "—";
  const correctedInstallment = formatMoney(calculation.corrected_installment_value) ?? "—";
  const monthlySavings = formatMoney(calculation.abusive_interest_per_installment) ?? "—";
  const totalSavings = formatMoney(calculation.estimated_savings) ?? "—";
  const settlementAmount = formatMoney(calculation.settlement_amount);
  const issueDate = dateFormatter.format(new Date());
  const clientName = optionalText(calculation.client_name) ?? "Cliente";
  const protocol = optionalText(protocolNumber) ?? "Em processamento";
  const model = resolveModel(calculation);

  const currentRows: SummaryRow[] = [
    ...(optionalText(calculation.financial_institution)
      ? [{ label: "Instituição financeira", value: calculation.financial_institution!.trim() }]
      : []),
    { label: "Produto analisado", value: formatSimulationType(calculation.simulation_type) },
    ...(model ? [{ label: "Modelo e ano", value: model }] : []),
    ...(formatMoney(calculation.financed_value)
      ? [{ label: "Valor financiado", value: formatMoney(calculation.financed_value)! }]
      : []),
    ...(formatInteger(calculation.installment_count)
      ? [{ label: "Total de parcelas", value: formatInteger(calculation.installment_count)! }]
      : []),
    ...(formatInteger(calculation.paid_installments)
      ? [{ label: "Parcelas pagas", value: formatInteger(calculation.paid_installments)! }]
      : []),
    ...(formatMoney(calculation.remaining_amount_to_pay)
      ? [
          {
            label: "Saldo devedor sem correção",
            value: formatMoney(calculation.remaining_amount_to_pay)!,
            tone: "negative" as const,
          },
        ]
      : []),
  ];

  const revisedRows: SummaryRow[] = [
    ...(formatMoney(calculation.corrected_total_financing)
      ? [
          {
            label: "Total da dívida após revisão",
            value: formatMoney(calculation.corrected_total_financing)!,
            tone: "positive" as const,
          },
        ]
      : []),
    ...(formatMoney(calculation.abusive_interest_paid)
      ? [
          {
            label: "Juros abusivos já pagos",
            value: formatMoney(calculation.abusive_interest_paid)!,
            tone: "positive" as const,
          },
        ]
      : []),
    ...(formatMoney(calculation.installment_reduction_remaining)
      ? [
          {
            label: "Parcela após abatimentos",
            value: formatMoney(calculation.installment_reduction_remaining)!,
            tone: "positive" as const,
          },
        ]
      : []),
    ...(formatMoney(calculation.real_debt)
      ? [
          {
            label: "Saldo devedor pós-correção",
            value: formatMoney(calculation.real_debt)!,
            tone: "positive" as const,
          },
        ]
      : []),
    ...(settlementAmount
      ? [
          {
            label: "Valor estimado para quitação",
            value: settlementAmount,
            tone: "positive" as const,
          },
        ]
      : []),
  ];

  const contactLine = [optionalText(companyPhone), optionalText(companyWebsite)]
    .filter(Boolean)
    .join("  •  ");
  const addressLine = optionalText(companyAddress);
  const logoMarkup = companyLogoSrc
    ? `<rect x="54" y="40" width="142" height="128" rx="12" fill="#FFFFFF" />
       <image href="${escapeXml(companyLogoSrc)}" x="66" y="51" width="118" height="106" preserveAspectRatio="xMidYMid meet" />`
    : `<rect x="54" y="40" width="142" height="128" rx="12" fill="#FFFFFF" />
       <text x="125" y="116" text-anchor="middle" class="logo-fallback">${escapeXml(
         getCompanyInitials(companyName),
       )}</text>`;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <style>
        text { font-family: "Helvetica", "Arial", sans-serif; }
        .eyebrow { font-size: 18px; font-weight: 700; letter-spacing: 2.2px; }
        .header-title { font-size: 34px; font-weight: 700; }
        .header-meta { font-size: 17px; font-weight: 500; }
        .logo-fallback { font-size: 32px; font-weight: 800; fill: #111111; }
        .hero-label { font-size: 19px; font-weight: 800; letter-spacing: 1.5px; fill: #087A55; }
        .hero-value { font-size: 53px; font-weight: 800; fill: #064E3B; }
        .hero-copy { font-size: 20px; font-weight: 500; fill: #374151; }
        .status { font-size: 16px; font-weight: 800; letter-spacing: 1px; fill: #087A55; }
        .metric-label { font-size: 17px; font-weight: 800; letter-spacing: 0.7px; fill: #4B5563; }
        .metric-value { font-size: 34px; font-weight: 800; }
        .metric-caption { font-size: 14px; font-weight: 500; fill: #6B7280; }
        .section-title { font-size: 21px; font-weight: 800; fill: #111827; }
        .section-kicker { font-size: 14px; font-weight: 700; letter-spacing: 1.2px; fill: #6B7280; }
        .row-label { font-size: 16px; font-weight: 500; fill: #4B5563; }
        .row-value { font-size: 17px; font-weight: 800; }
        .next-label { font-size: 16px; font-weight: 800; letter-spacing: 1.2px; fill: #B91C1C; }
        .next-copy { font-size: 21px; font-weight: 700; fill: #111827; }
        .footer { font-size: 14px; font-weight: 500; fill: #4B5563; }
        .footer-strong { font-size: 14px; font-weight: 700; fill: #111827; }
      </style>

      <rect width="1080" height="1350" fill="#F5F6F8" />
      <rect width="1080" height="208" fill="#111111" />
      <rect width="1080" height="10" fill="#B91C1C" />
      ${logoMarkup}
      <text x="226" y="70" class="eyebrow" fill="#EF4444">ANÁLISE DE CORREÇÃO DE JUROS</text>
      <text x="226" y="116" class="header-title" fill="#FFFFFF">SIMULAÇÃO RESUMIDA</text>
      <text x="226" y="154" class="header-meta" fill="#D1D5DB">${escapeXml(
        truncate(clientName, 42),
      )}</text>
      <text x="1026" y="66" text-anchor="end" class="header-meta" fill="#D1D5DB">${escapeXml(
        issueDate,
      )}</text>
      <text x="1026" y="99" text-anchor="end" class="header-meta" fill="#FFFFFF">Protocolo ${escapeXml(
        truncate(protocol, 24),
      )}</text>

      <rect x="54" y="238" width="972" height="178" rx="14" fill="#ECFDF5" stroke="#A7F3D0" />
      <rect x="54" y="238" width="10" height="178" rx="5" fill="#087A55" />
      <text x="88" y="283" class="hero-label">ECONOMIA TOTAL ESTIMADA</text>
      <text x="88" y="352" class="hero-value">${escapeXml(totalSavings)}</text>
      <text x="88" y="388" class="hero-copy">Potencial identificado a partir dos dados informados.</text>
      <rect x="790" y="268" width="196" height="42" rx="21" fill="#D1FAE5" />
      <text x="888" y="295" text-anchor="middle" class="status">ANÁLISE APROVADA</text>

      ${renderMetricCard({
        x: 54,
        label: "PARCELA ATUAL",
        value: currentInstallment,
        color: "#B42318",
        background: "#FFF7F7",
      })}
      ${renderMetricCard({
        x: 387,
        label: "PARCELA CORRIGIDA",
        value: correctedInstallment,
        color: "#087A55",
        background: "#F0FDF8",
      })}
      ${renderMetricCard({
        x: 720,
        label: "ECONOMIA MENSAL",
        value: monthlySavings,
        color: "#1769AA",
        background: "#F3F8FC",
      })}

      <rect x="54" y="625" width="471" height="440" rx="14" fill="#FFFFFF" stroke="#D1D5DB" />
      <rect x="555" y="625" width="471" height="440" rx="14" fill="#FFFFFF" stroke="#D1D5DB" />
      <rect x="54" y="625" width="471" height="8" rx="4" fill="#B91C1C" />
      <rect x="555" y="625" width="471" height="8" rx="4" fill="#087A55" />
      <text x="82" y="675" class="section-kicker">CENÁRIO INFORMADO</text>
      <text x="82" y="711" class="section-title">Contrato atual</text>
      <text x="583" y="675" class="section-kicker">CENÁRIO PROJETADO</text>
      <text x="583" y="711" class="section-title">Após análise revisional</text>
      ${renderRows(currentRows, 82, 758)}
      ${renderRows(revisedRows, 583, 758)}

      <rect x="54" y="1092" width="972" height="116" rx="14" fill="#FFFFFF" stroke="#D1D5DB" />
      <rect x="54" y="1092" width="10" height="116" rx="5" fill="#B91C1C" />
      <text x="88" y="1134" class="next-label">PRÓXIMO PASSO</text>
      <text x="88" y="1174" class="next-copy">Valide os documentos e as condições com seu especialista.</text>

      <line x1="54" y1="1240" x2="1026" y2="1240" stroke="#D1D5DB" stroke-width="1" />
      <text x="54" y="1276" class="footer-strong">${escapeXml(
        truncate(companyName, 42),
      )}</text>
      ${contactLine ? `<text x="1026" y="1276" text-anchor="end" class="footer">${escapeXml(truncate(contactLine, 65))}</text>` : ""}
      ${addressLine ? `<text x="54" y="1307" class="footer">${escapeXml(truncate(addressLine, 105))}</text>` : ""}
      <text x="1026" y="1307" text-anchor="end" class="footer">Valores estimativos sujeitos à validação documental.</text>
    </svg>
  `;
}

export async function generateCalculationSummaryImage(props: SummaryImageProps) {
  const svg = buildSummarySvg(props);

  return sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}
