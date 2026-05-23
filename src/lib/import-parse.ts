import * as XLSX from "xlsx";

export async function parseSpreadsheet(file: File): Promise<Record<string, any>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

export function downloadTemplate(filename: string, headers: string[], sample: Record<string, any>[] = []) {
  const ws = XLSX.utils.json_to_sheet(sample.length ? sample : [Object.fromEntries(headers.map((h) => [h, ""]))]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, filename);
}
