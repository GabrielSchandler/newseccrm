import { displayCpf } from "@/lib/clients/formatters";
import { formatCurrency } from "@/lib/pre-sales/formatters";
import type {
  PreSale,
  PreSaleClientSnapshot,
  PreSaleDebtHolder,
  PreSaleFinancialCase,
} from "@/types/pre-sale";

export type DocumentTemplateContext = {
  preSale: PreSale;
  snapshot: PreSaleClientSnapshot | null;
  debtHolder: PreSaleDebtHolder | null;
  financialCase: PreSaleFinancialCase | null;
};

function buildAddress(snapshot: PreSaleClientSnapshot | null) {
  if (!snapshot) {
    return "";
  }

  const streetLine = [
    snapshot.street,
    snapshot.number ? `n. ${snapshot.number}` : null,
  ].filter(Boolean);
  const cityLine = [snapshot.district, snapshot.city, snapshot.state].filter(Boolean);
  const zipCode = snapshot.zip_code ? `CEP ${snapshot.zip_code}` : null;

  return [streetLine.join(", "), cityLine.join(" - "), zipCode]
    .filter(Boolean)
    .join(", ");
}

export function renderDocumentTemplate(
  content: string,
  context: DocumentTemplateContext,
) {
  const { preSale, snapshot, debtHolder, financialCase } = context;
  const replacements: Record<string, string> = {
    cliente_nome: snapshot?.full_name ?? "",
    cliente_cpf: snapshot?.cpf ? displayCpf(snapshot.cpf) : "",
    cliente_endereco: buildAddress(snapshot),
    titular_nome: debtHolder?.full_name ?? "",
    valor_contrato: formatCurrency(preSale.contract_value),
    financeira: financialCase?.financer_name ?? "",
    data_atual: new Intl.DateTimeFormat("pt-BR").format(new Date()),
  };

  return content.replace(
    /{{\s*([\w_]+)\s*}}/g,
    (_, key: string) => replacements[key] ?? "",
  );
}
