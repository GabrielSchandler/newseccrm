import { readFile } from "node:fs/promises";
import readXlsxFile from "read-excel-file/node";

export type Equipe = "COMERCIAL" | "JURIDICO";

export type Venda = {
  nome: string;
  data: string;
  cliente: string;
  meta: number;
  equipe: Equipe;
};

export type VendasResponse = {
  vendas: Venda[];
  meta: number;
  refreshSeconds: number;
  updatedAt: string;
  source: string;
};

type SheetRow = Record<string, unknown>;

const REQUIRED_COLUMNS = ["DATA", "COLABORADOR", "NOME_CLIENTE", "META", "EQUIPE"];

export async function loadVendas(): Promise<VendasResponse> {
  const { buffer, source } = await fetchWorkbookBuffer();
  const vendas = await parseWorkbook(buffer);

  return {
    vendas,
    meta: readNumberEnv("DASHBOARD_META", 100000),
    refreshSeconds: readNumberEnv("DASHBOARD_REFRESH_SECONDS", 300),
    updatedAt: new Date().toISOString(),
    source,
  };
}

async function fetchWorkbookBuffer(): Promise<{ buffer: ArrayBuffer | Buffer; source: string }> {
  const directUrl = process.env.EXCEL_DOWNLOAD_URL?.trim();
  const localPath = process.env.LOCAL_EXCEL_PATH?.trim();

  if (localPath) {
    return {
      buffer: await readFile(localPath),
      source: "LOCAL_EXCEL_PATH",
    };
  }

  if (directUrl) {
    return {
      buffer: await fetchArrayBuffer(directUrl),
      source: "EXCEL_DOWNLOAD_URL",
    };
  }

  const graphUrl = getGraphDownloadUrl();

  if (graphUrl) {
    const token = await getGraphAccessToken();

    return {
      buffer: await fetchArrayBuffer(graphUrl, {
        Authorization: `Bearer ${token}`,
      }),
      source: "Microsoft Graph",
    };
  }

  throw new Error(
    "Configure EXCEL_DOWNLOAD_URL ou as variaveis Microsoft Graph para ler a planilha.",
  );
}

function getGraphDownloadUrl(): string | null {
  const fullUrl = process.env.GRAPH_FILE_DOWNLOAD_URL?.trim();

  if (fullUrl) {
    return fullUrl;
  }

  const driveId = process.env.GRAPH_DRIVE_ID?.trim();
  const filePath = process.env.GRAPH_FILE_PATH?.trim();

  if (!driveId || !filePath) {
    return null;
  }

  const encodedPath = filePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodedPath}:/content`;
}

async function getGraphAccessToken(): Promise<string> {
  const tenantId = requiredEnv("MS_TENANT_ID");
  const clientId = requiredEnv("MS_CLIENT_ID");
  const clientSecret = requiredEnv("MS_CLIENT_SECRET");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Falha ao autenticar no Microsoft Graph: HTTP ${response.status}`);
  }

  const data = (await response.json()) as { access_token?: string };

  if (!data.access_token) {
    throw new Error("Microsoft Graph nao retornou access_token.");
  }

  return data.access_token;
}

async function fetchArrayBuffer(url: string, headers?: Record<string, string>) {
  const response = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar a planilha: HTTP ${response.status}`);
  }

  return response.arrayBuffer();
}

async function parseWorkbook(buffer: ArrayBuffer | Buffer): Promise<Venda[]> {
  const workbook = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const sheets = await readXlsxFile(workbook);
  const selectedSheet = sheets.find((sheet) => sheet.sheet === "CONSOLIDADO") ?? sheets[0];

  if (!selectedSheet) {
    throw new Error("Nenhuma aba foi encontrada na planilha.");
  }

  const [headerRow, ...dataRows] = selectedSheet.data;

  if (!headerRow) {
    throw new Error("A planilha nao possui cabecalho.");
  }

  const headers = headerRow.map((header) => normalizeHeader(String(header ?? "")));
  const normalizedRows = dataRows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
  const columns = Object.keys(normalizedRows[0] ?? {});
  const missing = REQUIRED_COLUMNS.filter((column) => !columns.includes(column));

  if (missing.length > 0) {
    throw new Error(`Colunas ausentes na planilha: ${missing.join(", ")}`);
  }

  return normalizedRows
    .map(rowToVenda)
    .filter((venda): venda is Venda => Boolean(venda))
    .sort((a, b) => `${a.data}${a.nome}`.localeCompare(`${b.data}${b.nome}`));
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function rowToVenda(row: SheetRow): Venda | null {
  const equipe = String(row.EQUIPE ?? "")
    .trim()
    .toUpperCase();

  if (equipe !== "COMERCIAL" && equipe !== "JURIDICO") {
    return null;
  }

  const data = parseDate(row.DATA);
  const nome = String(row.COLABORADOR ?? "").trim();
  const cliente = String(row.NOME_CLIENTE ?? "").trim();
  const meta = parseCurrency(row.META);

  if (!data || !nome || !cliente || meta <= 0) {
    return null;
  }

  return {
    nome,
    data,
    cliente,
    meta,
    equipe,
  };
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    return new Date(Date.UTC(1899, 11, 30 + value)).toISOString().slice(0, 10);
  }

  const text = String(value ?? "").trim();
  const brDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (brDate) {
    return `${brDate[3]}-${brDate[2].padStart(2, "0")}-${brDate[1].padStart(2, "0")}`;
  }

  const isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2].padStart(2, "0")}-${isoDate[3].padStart(2, "0")}`;
  }

  return null;
}

function parseCurrency(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }

  return value;
}

function readNumberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
