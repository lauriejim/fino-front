// Shared formatting helpers.
//
// Number style: `,` as thousands separator, `.` as decimal separator.
// Example: 13,230.43

const NUMBER_2DP = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER_FLEX = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4,
});

export function formatEuro(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${NUMBER_2DP.format(value)} €`;
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)} %`;
}

/**
 * Generic number formatter. Uses `,` for thousands and `.` for decimals.
 * Up to 4 decimal places (e.g. useful for UC quantities).
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return NUMBER_FLEX.format(value);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  // ISO YYYY-MM-DD — keep simple, the app is FR; we don't localize yet
  return iso;
}
