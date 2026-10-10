export function formatMoney(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return (
    '₹' +
    rounded.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

/** Quantities can be fractional (e.g. 0.25 kg); trim float noise and trailing zeros. */
export function formatQty(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

export function totalQty(items: { qty: number }[]): number {
  return Math.round(items.reduce((sum, it) => sum + it.qty, 0) * 1000) / 1000;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return (
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
    ', ' +
    d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  );
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
