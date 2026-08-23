/** IATA codes for every origin/destination city in the dataset. */
const CITY_CODES: Record<string, string> = {
  Delhi: "DEL",
  Mumbai: "BOM",
  Bangalore: "BLR",
  Chennai: "MAA",
  Kolkata: "CCU",
  Hyderabad: "HYD",
};

export function cityCode(city: string): string {
  return CITY_CODES[city] ?? city.slice(0, 3).toUpperCase();
}

const AIRLINE_NAMES: Record<string, string> = {
  GO_FIRST: "Go First",
  Air_India: "Air India",
  Indigo: "IndiGo",
  Vistara: "Vistara",
  SpiceJet: "SpiceJet",
  AirAsia: "AirAsia",
  Trujet: "Trujet",
};

export function airlineName(raw: string): string {
  return AIRLINE_NAMES[raw] ?? raw.replace(/_/g, " ");
}

export function classTag(travelClass: string): string {
  const key = travelClass.toLowerCase();
  if (key === "business") return "BIZ";
  if (key === "economy") return "ECON";
  return travelClass.slice(0, 4).toUpperCase();
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  return inrFormatter.format(value);
}

export function formatPct(pct: number): string {
  const rounded = Math.abs(pct) < 0.05 ? 0 : pct;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`;
}

export function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function formatClock(ts: string | Date): string {
  const date = typeof ts === "string" ? new Date(ts) : ts;
  return date.toLocaleTimeString("en-GB", { hour12: false });
}
