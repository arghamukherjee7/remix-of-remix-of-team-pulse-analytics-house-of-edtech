// Indian Rupee formatting helpers (en-IN grouping: 1,00,000)
const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inrDec = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export function formatINR(value: number | string | null | undefined, opts?: { decimals?: boolean }): string {
  const n = Number(value ?? 0);
  if (!isFinite(n)) return "₹0";
  return `₹${(opts?.decimals ? inrDec : inr).format(n)}`;
}

export function formatINRCompact(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!isFinite(n)) return "₹0";
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return formatINR(n);
}
