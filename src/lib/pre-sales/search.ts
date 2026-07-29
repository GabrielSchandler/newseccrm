import type {
  ClientOption,
  PreSaleDebtHolder,
  PreSaleSearchMatch,
} from "@/types/pre-sale";

type SearchPerson =
  | Pick<ClientOption, "full_name" | "cpf">
  | Pick<PreSaleDebtHolder, "full_name" | "cpf">
  | null
  | undefined;

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function onlyDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function findPersonMatch(
  term: string,
  person: SearchPerson,
  source: PreSaleSearchMatch["source"],
  label: string,
) {
  const normalizedTerm = normalizeText(term);
  const digitTerm = onlyDigits(term);
  const normalizedName = normalizeText(person?.full_name);
  const cpfDigits = onlyDigits(person?.cpf);

  if (normalizedTerm && normalizedName.includes(normalizedTerm)) {
    return {
      source,
      field: "name",
      label,
      value: person?.full_name ?? null,
    } satisfies PreSaleSearchMatch;
  }

  if (digitTerm && cpfDigits.includes(digitTerm)) {
    return {
      source,
      field: "cpf",
      label,
      value: person?.cpf ?? null,
    } satisfies PreSaleSearchMatch;
  }

  return null;
}

function isSamePerson(client: SearchPerson, debtHolder: SearchPerson) {
  const clientCpf = onlyDigits(client?.cpf);
  const debtHolderCpf = onlyDigits(debtHolder?.cpf);

  if (clientCpf && debtHolderCpf) {
    return clientCpf === debtHolderCpf;
  }

  const clientName = normalizeText(client?.full_name);
  const debtHolderName = normalizeText(debtHolder?.full_name);

  return Boolean(clientName && debtHolderName && clientName === debtHolderName);
}

export function getPreSaleSearchMatches(
  term: string | null | undefined,
  client: SearchPerson,
  debtHolder: SearchPerson,
) {
  const searchTerm = term?.trim();

  if (!searchTerm) {
    return [];
  }

  const matches: PreSaleSearchMatch[] = [];
  const clientMatch = findPersonMatch(searchTerm, client, "client", "Cliente");

  if (clientMatch) {
    matches.push(clientMatch);
  }

  if (!isSamePerson(client, debtHolder)) {
    const debtHolderMatch = findPersonMatch(
      searchTerm,
      debtHolder,
      "debt_holder",
      "Financiado",
    );

    if (debtHolderMatch) {
      matches.push(debtHolderMatch);
    }
  }

  return matches;
}
