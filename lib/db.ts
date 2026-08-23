import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

import { ensureSeeded } from "@/lib/poll-sim";

/**
 * Database handle.
 *
 * On a real deployment we can't rely on `fixture.db` being present at runtime
 * (Vercel's serverless functions ship without repo-root files), so we lazy-
 * bootstrap an in-memory SQLite with the same schema and a small seed dataset
 * when the on-disk file is missing. The poller + SSE handlers all keep their
 * existing API surface.
 */
declare global {
  // eslint-disable-next-line no-var
  var __flightDb: Database.Database | undefined;
}

function bootstrap() {
  const filePath = path.join(process.cwd(), "fixture.db");
  const onDisk = fs.existsSync(filePath);

  const db = onDisk
    ? new Database(filePath, { readonly: false, fileMustExist: true })
    : new Database(":memory:");

  db.pragma("journal_mode = WAL");

  if (!onDisk) {
    db.exec(`
      CREATE TABLE items (
        item_key TEXT PRIMARY KEY,
        source_city TEXT NOT NULL,
        destination_city TEXT NOT NULL,
        airline TEXT NOT NULL,
        flight TEXT NOT NULL,
        travel_class TEXT NOT NULL,
        duration REAL NOT NULL,
        degraded INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        item_key TEXT NOT NULL,
        price REAL NOT NULL
      );

      CREATE TABLE deltas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        item_key TEXT NOT NULL,
        old_price REAL NOT NULL,
        new_price REAL NOT NULL,
        pct_change REAL NOT NULL,
        direction TEXT NOT NULL
      );
    `);
  }

  return db;
}

function getDb(): Database.Database {
  if (!globalThis.__flightDb) {
    globalThis.__flightDb = bootstrap();
  }
  return globalThis.__flightDb;
}

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
  ensureSeeded();
  return getDb()
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
  ensureSeeded();
  return getDb()
    .prepare("SELECT * FROM deltas WHERE id > ? ORDER BY id ASC")
    .all(sinceId) as DeltaRow[];
}

/** Full snapshot history for one item (chronological). */
export function getHistoryForItem(itemKey: string): SnapshotRow[] {
  ensureSeeded();
  return getDb()
    .prepare(
      "SELECT ts, price FROM snapshots WHERE item_key = ? ORDER BY ts ASC"
    )
    .all(itemKey) as SnapshotRow[];
}

/** Most recent deltas for one item, newest first. */
export function getRecentDeltasForItem(itemKey: string, limit = 5): DeltaRow[] {
  ensureSeeded();
  return getDb()
    .prepare(
      "SELECT * FROM deltas WHERE item_key = ? ORDER BY id DESC LIMIT ?"
    )
    .all(itemKey, limit) as DeltaRow[];
}

/** Current degraded flags for all items. */
export function getDegradedFlags(): Record<string, number> {
  ensureSeeded();
  const rows = getDb()
    .prepare("SELECT item_key, degraded FROM items")
    .all() as { item_key: string; degraded: number }[];
  return Object.fromEntries(rows.map((r) => [r.item_key, r.degraded]));
}

/** Toggle the degraded flag for an item. Returns the new value. */
export function setDegraded(itemKey: string, degraded: boolean): number {
  ensureSeeded();
  const value = degraded ? 1 : 0;
  const result = getDb()
    .prepare("UPDATE items SET degraded = ? WHERE item_key = ?")
    .run(value, itemKey);
  if (result.changes === 0) throw new Error(`Unknown item_key: ${itemKey}`);
  return value;
}

/** Max delta id currently in the table (stream cursor bootstrap). */
export function getMaxDeltaId(): number {
  ensureSeeded();
  const row = getDb()
    .prepare("SELECT COALESCE(MAX(id), 0) AS max_id FROM deltas")
    .get() as { max_id: number };
  return row.max_id;
}

export default getDb;