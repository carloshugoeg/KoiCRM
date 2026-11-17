import { Prisma } from "@prisma/client";

export type CsvValue = string | number | boolean | null | bigint | Date | Prisma.Decimal | object;

const FORMULA = /^[=+\-@\t\r]/;

function stringify(value: CsvValue | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Prisma.Decimal.isDecimal(value)) return value.toString();
  return JSON.stringify(value) ?? "";
}

function escapeFormula(text: string): string {
  return FORMULA.test(text) ? `'${text}` : text;
}

function quote(text: string): string {
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map((value) => quote(escapeFormula(stringify(value)))).join(",")
  );
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
