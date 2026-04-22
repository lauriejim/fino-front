// Small parser helpers — ported from v1 tui/helpers/parser-functions.js .

/** Accepts "YYYY-MM-DD" (returned as-is) or "DD/MM/YYYY" → "YYYY-MM-DD". */
export function toISODate(dateStr: string): string {
  if (dateStr.includes("-")) return dateStr;
  const [day, month, year] = dateStr.split("/");
  if (!day || !month || !year) {
    throw new Error(`Invalid date format, expected DD/MM/YYYY: "${dateStr}"`);
  }
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

const FR_MONTHS: Record<string, string> = {
  janvier: "01",
  février: "02",
  fevrier: "02",
  mars: "03",
  avril: "04",
  mai: "05",
  juin: "06",
  juillet: "07",
  août: "08",
  aout: "08",
  septembre: "09",
  octobre: "10",
  novembre: "11",
  décembre: "12",
  decembre: "12",
};

/** "12 janvier 2026" → "2026-01-12". */
export function frenchDateToISO(dateStr: string): string {
  const parts = dateStr.toLowerCase().trim().split(/\s+/);
  const day = (parts[0] ?? "").padStart(2, "0");
  const month = FR_MONTHS[parts[1] ?? ""];
  const year = parts[2];
  if (!month) throw new Error(`Invalid month in date: "${dateStr}"`);
  return `${year}-${month}-${day}`;
}
