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
  const dataRows = rows.slice(startRow - 1);

  return dataRows.flatMap((row, index) => {
    const rowNumber = startRow + index;
    const fullName = getCell(row, source.name_column) ?? "";
    const phone = onlyDigits(getCell(row, source.phone_column));
    const email = normalizeEmail(getCell(row, source.email_column));
    const cpf = onlyDigits(getCell(row, source.cpf_column));
    const campaign = getCell(row, source.campaign_column);
    const notes = getCell(row, source.notes_column);

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
        rawData: Object.fromEntries(row.map((cell, cellIndex) => [String(cellIndex + 1), cell])),
      },
    ] satisfies ParsedSheetLead[];
  });
}
