import Database from "better-sqlite3";
import path from "node:path";

const db = new Database(path.join(process.cwd(), "fixture.db"), {
  // The poller writes while the SSE stream reads — never block either side.
  readonly: false,
  fileMustExist: true,
});
db.pragma("journal_mode = WAL");

export interface ItemRow {
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
}

export interface DeltaRow {
  id: number;
  ts: string;
  item_key: string;
  old_price: number;
  new_price: number;
  pct_change: number;
  direction: "up" | "down";
}

export interface SnapshotRow {
  ts: string;
  price: number;
}

/** Latest snapshot per tracked item, joined with its static metadata. */
export function getLatestByItem(): ItemRow[] {
  return db
    .prepare(
      `
      SELECT s.item_key, s.price, s.ts,
             i.source_city, i.destination_city, i.airline, i.flight,
             i.travel_class, i.duration, i.degraded
      FROM snapshots s
      JOIN items i ON i.item_key = s.item_key
      WHERE s.id IN (SELECT MAX(id) FROM snapshots GROUP BY item_key)
      ORDER BY i.source_city, i.destination_city
      `
    )
    .all() as ItemRow[];
}

/** Delta rows newer than `sinceId`, oldest first. */
export function getRecentDeltas(sinceId: number): DeltaRow[] {
  return db
    .prepare("SELECT * FROM deltas WHERE id > ? ORDER BY id ASC")
    .all(sinceId) as DeltaRow[];
}

/** Full snapshot history for one item (chronological). */
export function getHistoryForItem(itemKey: string): SnapshotRow[] {
  return db
    .prepare(
      "SELECT ts, price FROM snapshots WHERE item_key = ? ORDER BY ts ASC"
    )
    .all(itemKey) as SnapshotRow[];
}

/** Most recent deltas for one item, newest first. */
export function getRecentDeltasForItem(itemKey: string, limit = 5): DeltaRow[] {
  return db
    .prepare(
      "SELECT * FROM deltas WHERE item_key = ? ORDER BY id DESC LIMIT ?"
    )
    .all(itemKey, limit) as DeltaRow[];
}

/** Current degraded flags for all items. */
export function getDegradedFlags(): Record<string, number> {
  const rows = db
    .prepare("SELECT item_key, degraded FROM items")
    .all() as { item_key: string; degraded: number }[];
  return Object.fromEntries(rows.map((r) => [r.item_key, r.degraded]));
}

/** Toggle the degraded flag for an item. Returns the new value. */
export function setDegraded(itemKey: string, degraded: boolean): number {
  const value = degraded ? 1 : 0;
  const result = db
    .prepare("UPDATE items SET degraded = ? WHERE item_key = ?")
    .run(value, itemKey);
  if (result.changes === 0) throw new Error(`Unknown item_key: ${itemKey}`);
  return value;
}

/** Max delta id currently in the table (stream cursor bootstrap). */
export function getMaxDeltaId(): number {
  const row = db.prepare("SELECT COALESCE(MAX(id), 0) AS max_id FROM deltas").get() as {
    max_id: number;
  };
  return row.max_id;
}

export default db;
