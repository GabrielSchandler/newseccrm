export type SheetLeadSource = {
  id: string;
  sheet_url: string;
  sheet_gid: string | null;
  start_row: number | null;
  name_column: string | null;
  phone_column: string | null;
  email_column: string | null;
  cpf_column: string | null;
  campaign_column: string | null;
  notes_column: string | null;
};

export type ParsedSheetLead = {
  rowNumber: number;
  rowKey: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  campaign: string | null;
  notes: string | null;
  rawData: Record<string, string>;
};

function normalizeText(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text || null;
}

export function onlyDigits(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits || null;
}

function normalizeEmail(value: string | null | undefined) {
  const text = normalizeText(value);
  return text ? text.toLowerCase() : null;
}

function columnIndex(column: string | null | undefined) {
  const normalized = column?.trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  if (/^\d+$/.test(normalized)) {
    const numeric = Number(normalized);
    return Number.isFinite(numeric) && numeric > 0 ? numeric - 1 : null;
  }

  if (!/^[A-Z]+$/.test(normalized)) {
    return null;
  }

  let index = 0;
  for (const char of normalized) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }

  return index - 1;
}

function getCell(row: string[], column: string | null | undefined) {
  const index = columnIndex(column);
  return index === null ? null : normalizeText(row[index]);
}

function normalizeHeader(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function buildHeaderIndex(headers: string[]) {
  const map = new Map<string, number>();

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);

    if (normalized && !map.has(normalized)) {
      map.set(normalized, index);
    }
  });

  return map;
}

function findHeaderColumn(
  headerIndex: Map<string, number>,
  candidates: string[],
) {
  for (const candidate of candidates) {
    const index = headerIndex.get(normalizeHeader(candidate));

    if (index !== undefined) {
      return index;
    }
  }

  return null;
}

function getCellByHeaderOrColumn(
  row: string[],
  headers: string[],
  headerIndex: Map<string, number>,
  configuredColumn: string | null | undefined,
  headerCandidates: string[],
) {
  const configuredIndex = columnIndex(configuredColumn);
  const headerIndexMatch = findHeaderColumn(headerIndex, headerCandidates);
  const configuredHeader = configuredIndex === null ? null : headers[configuredIndex];
  const configuredHeaderMatches =
    configuredHeader !== null &&
    headerCandidates.some(
      (candidate) => normalizeHeader(candidate) === normalizeHeader(configuredHeader),
    );

  if (configuredHeaderMatches || headerIndexMatch === null) {
    return getCell(row, configuredColumn);
  }

  return normalizeText(row[headerIndexMatch]);
}

function getRawData(row: string[], headers: string[]) {
  return Object.fromEntries(
    row.map((cell, cellIndex) => {
      const header = normalizeText(headers[cellIndex]);
      const key = header || String(cellIndex + 1);
      return [key, cell];
    }),
  );
}

export function extractGoogleSheetInfo(sheetUrl: string, fallbackGid?: string | null) {
  const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const spreadsheetId = idMatch?.[1] ?? null;

  let gid = fallbackGid?.trim() || null;

  if (!gid) {
    try {
      const url = new URL(sheetUrl);
      gid = url.searchParams.get("gid");

      if (!gid && url.hash.includes("gid=")) {
        gid = new URLSearchParams(url.hash.replace(/^#/, "")).get("gid");
      }
    } catch {
      gid = null;
    }
  }

  if (gid && !/^\d+$/.test(gid)) {
    gid = null;
  }

  if (!spreadsheetId) {
    throw new Error("Link da planilha invalido. Use um link do Google Sheets.");
  }

  return { spreadsheetId, gid };
}

function buildCsvUrl(source: SheetLeadSource) {
  const { spreadsheetId, gid } = extractGoogleSheetInfo(
    source.sheet_url,
    source.sheet_gid,
  );
  const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export`);
  url.searchParams.set("format", "csv");

  if (gid) {
    url.searchParams.set("gid", gid);
  }

  return url.toString();
}

export function parseCsv(csv: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  rows.push(row);

  return rows.filter((item) => item.some((cell) => cell.trim()));
}

export async function fetchSheetLeads(source: SheetLeadSource) {
  const csvUrl = buildCsvUrl(source);
  const response = await fetch(csvUrl, {
    cache: "no-store",
    headers: {
      Accept: "text/csv,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Nao foi possivel ler a planilha. Confirme se o link esta compartilhado. HTTP ${response.status}.`,
    );
  }

  const csv = await response.text();

  if (/^\s*</.test(csv)) {
    throw new Error(
      "A planilha retornou uma pagina HTML. Compartilhe a planilha como 'qualquer pessoa com o link pode visualizar' ou publique a aba.",
    );
  }

  const rows = parseCsv(csv);
  const startRow = Math.max(Number(source.start_row ?? 2), 1);
  const headers = rows[Math.max(startRow - 2, 0)] ?? [];
  const headerIndex = buildHeaderIndex(headers);
  const dataRows = rows.slice(startRow - 1);

  return dataRows.flatMap((row, index) => {
    const rowNumber = startRow + index;
    const fullName =
      getCellByHeaderOrColumn(row, headers, headerIndex, source.name_column, [
        "nome",
        "nome completo",
        "cliente",
        "lead",
      ]) ?? "";
    const phone = onlyDigits(
      getCellByHeaderOrColumn(row, headers, headerIndex, source.phone_column, [
        "telefone",
        "telefone celular",
        "celular",
        "whatsapp",
        "whats",
      ]),
    );
    const email = normalizeEmail(
      getCellByHeaderOrColumn(row, headers, headerIndex, source.email_column, [
        "email",
        "e-mail",
        "melhor email",
      ]),
    );
    const cpf = onlyDigits(
      getCellByHeaderOrColumn(row, headers, headerIndex, source.cpf_column, [
        "cpf",
        "documento",
      ]),
    );
    const campaign =
      getCellByHeaderOrColumn(row, headers, headerIndex, source.campaign_column, [
        "midia",
        "mídia",
        "origem",
        "campanha",
        "fonte",
      ]) ??
      getCellByHeaderOrColumn(row, headers, headerIndex, null, [
        "tipo de financiamento",
        "produto",
      ]);
    const notes = getCellByHeaderOrColumn(
      row,
      headers,
      headerIndex,
      source.notes_column,
      ["observacao", "observação", "obs", "comentario", "comentário"],
    );

    if (!fullName && !phone && !email && !cpf) {
      return [];
    }

    return [
      {
        rowNumber,
        rowKey: String(rowNumber),
        fullName: fullName || `Lead linha ${rowNumber}`,
        phone,
        email,
        cpf,
        campaign,
        notes,
        rawData: getRawData(row, headers),
      },
    ] satisfies ParsedSheetLead[];
  });
}
