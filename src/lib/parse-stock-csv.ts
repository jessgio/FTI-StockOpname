export interface ParsedStockLine {
  sku: string;
  gudang: string;
  quantity: number;
}

function normHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function columnIndex(headers: string[], names: string[]): number {
  for (const name of names) {
    const idx = headers.indexOf(name);
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Parse a system stock CSV. Expects sku, gudang (or warehouse), and quantity columns.
 * Falls back to first three columns when no header row matches.
 */
export function parseSystemStockCsv(text: string): ParsedStockLine[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const rows = lines.map(parseCsvLine);
  const headers = rows[0].map(normHeader);
  const skuIdx = columnIndex(headers, ["sku", "item", "item_code", "product"]);
  const gudangIdx = columnIndex(headers, ["gudang", "warehouse", "wh"]);
  const qtyIdx = columnIndex(headers, [
    "quantity",
    "qty",
    "on_hand",
    "stock",
    "system_qty",
  ]);

  const hasHeader = skuIdx >= 0 && gudangIdx >= 0 && qtyIdx >= 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const cols = hasHeader
    ? { sku: skuIdx, gudang: gudangIdx, qty: qtyIdx }
    : { sku: 0, gudang: 1, qty: 2 };

  const parsed: ParsedStockLine[] = [];
  for (const row of dataRows) {
    const sku = (row[cols.sku] ?? "").trim();
    const gudang = (row[cols.gudang] ?? "").trim();
    const quantity = Number((row[cols.qty] ?? "").replace(/,/g, ""));
    if (!sku || !gudang || !Number.isFinite(quantity)) continue;
    parsed.push({ sku, gudang, quantity });
  }
  return parsed;
}
