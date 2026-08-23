#!/usr/bin/env node
/**
 * Fixture generator — faithful Node port of the reference Python script.
 *
 * Reads Clean_Dataset.csv, picks N tracked route/airline/class combos,
 * walks their prices forward with a random walk (occasional big jumps),
 * and writes items / snapshots / deltas into SQLite using the exact same
 * schema the live scraper poller will write to later.
 *
 * Usage:
 *   node scripts/generate-fixture.mjs [csvPath] [dbPath] [--routes=8] [--snapshots=30] [--interval=15]
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const flag = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : dflt;
};

const csvPath = positional[0] ?? "Clean_Dataset.csv";
const dbPath = positional[1] ?? "fixture.db";
const NUM_ROUTES = flag("routes", 8);
const NUM_SNAPSHOTS = flag("snapshots", 30);
const INTERVAL_MINUTES = flag("interval", 15);

// ---------------------------------------------------------------------------
// Deterministic RNG (seeded, replaces Python's random_state=42 sampling)
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);
const random = () => rng();
const sample = (arr, n) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
};
const median = (nums) => {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
};

// ---------------------------------------------------------------------------
// Minimal CSV parser (handles quoted fields)
// ---------------------------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Core pipeline (mirrors the Python reference)
// ---------------------------------------------------------------------------

const buildItemKey = (r) =>
  `${r.source_city}-${r.destination_city}-${r.airline}-${r.class}`;

function pickTrackedItems(rows, nRoutes) {
  const groups = new Map();

  for (const r of rows) {
    const key = buildItemKey(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  let items = [...groups.entries()].map(([itemKey, groupRows]) => ({
    item_key: itemKey,
    source_city: groupRows[0].source_city,
    destination_city: groupRows[0].destination_city,
    airline: groupRows[0].airline,
    flight: groupRows[0].flight,
    travel_class: groupRows[0].class,
    duration: median(groupRows.map((r) => Number(r.duration))),
    base_price: median(groupRows.map((r) => Number(r.price))),
  }));

  if (items.length > nRoutes) items = sample(items, nRoutes);

  return items.sort((a, b) => b.base_price - a.base_price);
}

function simulateSnapshots(items, nSnapshots, intervalMinutes) {
  const now = Date.now();
  const rows = [];

  for (const item of items) {
    let price = item.base_price;
    for (let i = 0; i < nSnapshots; i++) {
      const ts = now - intervalMinutes * 60_000 * (nSnapshots - i);

      // Small drift most of the time, occasional bigger jump
      let pct;
      if (random() < 0.12) pct = (random() - 0.5) * 0.3; // ±15%
      else pct = (random() - 0.5) * 0.06; // ±3%

      price = Math.max(price * (1 + pct), 500); // price floor, like the reference
      rows.push({ ts: new Date(ts).toISOString(), item_key: item.item_key, price });
    }
  }

  // Chronological across all items, matching the reference output shape
  return rows.sort((a, b) => a.ts.localeCompare(b.ts));
}

function writeSqlite(items, snapshotRows) {
  if (fs.existsSync(dbPath)) fs.rmSync(dbPath);
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

  const conn = new Database(dbPath);
  conn.pragma("journal_mode = WAL");

  conn.exec(`
    CREATE TABLE IF NOT EXISTS items (
      item_key TEXT PRIMARY KEY,
      source_city TEXT,
      destination_city TEXT,
      airline TEXT,
      flight TEXT,
      travel_class TEXT,
      duration REAL,
      degraded INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT,
      item_key TEXT,
      price REAL,
      FOREIGN KEY (item_key) REFERENCES items(item_key)
    );
    CREATE INDEX IF NOT EXISTS idx_snapshots_item ON snapshots(item_key);

    CREATE TABLE IF NOT EXISTS deltas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT,
      item_key TEXT,
      old_price REAL,
      new_price REAL,
      pct_change REAL,
      direction TEXT
    );
  `);

  const insertItem = conn.prepare(
    "INSERT OR REPLACE INTO items VALUES (?,?,?,?,?,?,?,0)"
  );
  const insertSnapshot = conn.prepare(
    "INSERT INTO snapshots (ts, item_key, price) VALUES (?,?,?)"
  );
  const insertDelta = conn.prepare(
    "INSERT INTO deltas (ts, item_key, old_price, new_price, pct_change, direction) VALUES (?,?,?,?,?,?)"
  );

  conn.transaction(() => {
    for (const item of items) {
      insertItem.run(
        item.item_key,
        item.source_city,
        item.destination_city,
        item.airline,
        item.flight,
        item.travel_class,
        item.duration
      );
    }

    for (const { ts, item_key, price } of snapshotRows) {
      insertSnapshot.run(ts, item_key, Math.round(price * 100) / 100);
    }

    // Derive deltas from consecutive snapshots per item — same shape the live
    // diff engine will produce from real scraper runs.
    const lastPrice = {};
    for (const { ts, item_key, price } of snapshotRows) {
      if (item_key in lastPrice && lastPrice[item_key] !== price) {
        const old = lastPrice[item_key];
        const pct = ((price - old) / old) * 100;
        insertDelta.run(
          ts,
          item_key,
          old,
          price,
          Math.round(pct * 100) / 100,
          price > old ? "up" : "down"
        );
      }
      lastPrice[item_key] = price;
    }
  })();

  conn.close();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(csvPath)) {
    console.error(`Could not find ${csvPath}. Please check the path.`);
    process.exit(1);
  }

  const text = fs.readFileSync(csvPath, "utf8");
  const [header, ...dataRows] = parseCsv(text);

  const colIdx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  const required = [
    "airline",
    "flight",
    "source_city",
    "destination_city",
    "class",
    "duration",
    "price",
  ];
  const missing = required.filter((c) => !(c in colIdx));
  if (missing.length > 0) {
    console.error(`CSV is missing expected columns: ${missing.join(", ")}`);
    process.exit(1);
  }

  const rows = dataRows.map((r) => ({
    airline: r[colIdx.airline],
    flight: r[colIdx.flight],
    source_city: r[colIdx.source_city],
    destination_city: r[colIdx.destination_city],
    class: r[colIdx.class],
    duration: r[colIdx.duration],
    price: r[colIdx.price],
  }));

  const items = pickTrackedItems(rows, NUM_ROUTES);
  const snapshotRows = simulateSnapshots(items, NUM_SNAPSHOTS, INTERVAL_MINUTES);
  writeSqlite(items, snapshotRows);

  console.log(
    `Seeded ${items.length} tracked items with ${snapshotRows.length} snapshots into ${dbPath}`
  );
  console.log("Tracked items:");
  for (const item of items) {
    console.log(
      `  ${item.item_key}  (base price ~${Math.round(item.base_price)})`
    );
  }
}

main();
