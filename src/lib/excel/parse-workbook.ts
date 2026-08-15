import * as XLSX from 'xlsx';
import Papa from 'papaparse';

/**
 * Client-side file parsing (design.md section 11, steps 1–3).
 * Everything happens in the browser: the file is read with
 * `file.arrayBuffer()` and parsed with SheetJS (xlsx/xls) or Papa Parse
 * (csv). Nothing is uploaded.
 */

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB POC limit
export const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export interface ParsedSheet {
  name: string;
  headers: string[];
  /** raw rows keyed by the sheet's own headers */
  rows: Record<string, unknown>[];
}

export interface ParsedFile {
  fileName: string;
  sizeBytes: number;
  format: 'xlsx' | 'csv';
  sheets: ParsedSheet[];
}

export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportFileError';
  }
}

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

export function validateFile(file: File): void {
  const ext = extensionOf(file.name);
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    throw new ImportFileError(`Unsupported file type "${ext || 'unknown'}". Accepted formats: ${ACCEPTED_EXTENSIONS.join(', ')}.`);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportFileError(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum 10 MB.`);
  }
  if (file.size === 0) {
    throw new ImportFileError('The selected file is empty.');
  }
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function sheetToParsed(ws: XLSX.WorkSheet, name: string): ParsedSheet {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true, blankrows: false });
  if (aoa.length === 0) return { name, headers: [], rows: [] };
  const headers = (aoa[0] ?? []).map((h) => cellToString(h).trim());
  const rows: Record<string, unknown>[] = [];
  for (let r = 1; r < aoa.length; r++) {
    const arr = aoa[r];
    if (!arr || arr.every((c) => c === null || c === '')) continue;
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) row[h] = arr[i] ?? null;
    });
    rows.push(row);
  }
  return { name, headers, rows };
}

async function parseCsv(file: File): Promise<ParsedFile> {
  const text = await file.text();
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (result.errors.length > 0 && result.data.length === 0) {
    throw new ImportFileError(`Could not parse CSV: ${result.errors[0].message}`);
  }
  const headers = (result.meta.fields ?? []).filter(Boolean);
  return {
    fileName: file.name,
    sizeBytes: file.size,
    format: 'csv',
    sheets: [{ name: 'csv', headers, rows: result.data }],
  };
}

async function parseWorkbook(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: true, raw: false });
  } catch {
    throw new ImportFileError('Could not read the workbook. Is it a valid Excel file?');
  }
  const sheets = wb.SheetNames.map((name) => sheetToParsed(wb.Sheets[name], name)).filter(
    (s) => s.headers.length > 0,
  );
  if (sheets.length === 0) {
    throw new ImportFileError('The workbook contains no readable sheets.');
  }
  return { fileName: file.name, sizeBytes: file.size, format: 'xlsx', sheets };
}

/** Parse an accepted import file entirely in the browser. */
export async function parseImportFile(file: File): Promise<ParsedFile> {
  validateFile(file);
  return extensionOf(file.name) === '.csv' ? parseCsv(file) : parseWorkbook(file);
}

/**
 * Pick the sheet that carries raw data-entry rows: the sheet named
 * `Observations` when present (the v2 template), otherwise the first sheet
 * that is not `README`/`Lists`/`metadata`/`metrics`, falling back to the
 * first sheet.
 */
export function pickObservationSheet(parsed: ParsedFile): ParsedSheet {
  const byName = parsed.sheets.find((s) => s.name.trim().toLowerCase() === 'observations');
  if (byName) return byName;
  const nonMeta = parsed.sheets.find(
    (s) => !['readme', 'lists', 'metadata', 'metrics'].includes(s.name.trim().toLowerCase()),
  );
  return nonMeta ?? parsed.sheets[0];
}

/** True when the file looks like the v2 raw data-entry template. */
export function isRawTemplate(parsed: ParsedFile): boolean {
  const sheet = parsed.sheets.find((s) => s.name.trim().toLowerCase() === 'observations');
  if (!sheet) return false;
  const norm = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return sheet.headers.some((h) => norm(h) === 'unitoftheinstitution' || norm(h) === 'unitid');
}
