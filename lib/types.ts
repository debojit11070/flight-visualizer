export type FareDirection = "up" | "down" | null;

/** A route tile as rendered on the board (client-side shape). */
export interface BoardItem {
  item_key: string;
  price: number;
  ts: string;
  source_city: string;
  destination_city: string;
  airline: string;
  flight: string;
  travel_class: string;
  duration: number;
  degraded: boolean;
  direction: FareDirection;
  /** Signed percent change behind the current direction, if any. */
  lastPct?: number;
}

export interface DeltaEvent {
  id: number;
  ts: string;
  item_key: string;
  old_price: number;
  new_price: number;
  pct_change: number;
  direction: "up" | "down";
}

export type StreamEvent =
  | { type: "deltas"; rows: DeltaEvent[] }
  | { type: "state"; degraded: Record<string, number> };

export function toBoardItem(row: {
  item_key: string;
  price: number;
  ts: string;
  source_city: string;
  destination_city: string;
  airline: string;
  flight: string;
  travel_class: string;
  duration: number;
  degraded: number;
}): BoardItem {
  return {
    item_key: row.item_key,
    price: row.price,
    ts: row.ts,
    source_city: row.source_city,
    destination_city: row.destination_city,
    airline: row.airline,
    flight: row.flight,
    travel_class: row.travel_class,
    duration: row.duration,
    degraded: Boolean(row.degraded),
    direction: null,
    lastPct: undefined,
  };
}
