import getDb from "@/lib/db";
import type Database from "better-sqlite3";

/**
 * Simulated scraper run — stands in for the Bright Data poller until the real
 * collector is wired. Writes into the exact tables the live scraper will use
 * (items / snapshots / deltas), so nothing downstream changes when we swap it.
 *
 * One call = one "poll cycle":
 *   - every tracked item gets a fresh snapshot row
 *   - fares only *move* sometimes (like real markets), so a delta row is
 *     written only when the price actually changed
 */

// Resolve the singleton inside each function so we don't capture a stale handle
// across serverless invocations.
function conn(): Database.Database {
  return getDb() as unknown as Database.Database;
}

interface LastPrice {
  item_key: string;
  price: number;
}

const MOVE_PROBABILITY = 0.25;

function nextPrice(current: number): number {
  // Same volatility profile as the fixture generator:
  // occasional big jump, mostly small drift.
  const pct = Math.random() < 0.12 ? (Math.random() - 0.5) * 0.3 : (Math.random() - 0.5) * 0.06;
  return Math.max(Math.round(current * (1 + pct) * 100) / 100, 500);
}

/**
 * Seed an empty in-memory DB with a realistic Indian-domestic route catalog.
 * Mirrors the row shape of `fixture.db` so the rest of the system doesn't
 * notice whether we're running against disk or RAM.
 */
export function ensureSeeded(): void {
  const db = conn();
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM items")
    .get() as { n: number };
  if (row.n > 0) return;

  const routes: Array<[string, string, string, string, string, string, number]> = [
    ["Delhi", "Mumbai", "Air_India", "AI101", "economy", "02:15", 4800],
    ["Delhi", "Mumbai", "Vistara", "UK951", "business", "02:15", 14500],
    ["Delhi", "Bangalore", "Indigo", "6E345", "economy", "02:55", 5200],
    ["Delhi", "Bangalore", "Air_India", "AI505", "economy", "02:55", 5900],
    ["Mumbai", "Bangalore", "Indigo", "6E612", "economy", "01:45", 3400],
    ["Mumbai", "Bangalore", "Vistara", "UK887", "economy", "01:45", 3900],
    ["Mumbai", "Chennai", "Indigo", "6E234", "economy", "02:00", 3700],
    ["Bangalore", "Hyderabad", "Indigo", "6E478", "economy", "01:15", 2600],
    ["Bangalore", "Hyderabad", "AirAsia", "I5156", "economy", "01:15", 2400],
    ["Chennai", "Kolkata", "SpiceJet", "SG815", "economy", "02:25", 4100],
    ["Chennai", "Hyderabad", "Indigo", "6E692", "economy", "01:30", 2900],
    ["Kolkata", "Delhi", "Air_India", "AI201", "economy", "02:20", 4900],
    ["Kolkata", "Mumbai", "Vistara", "UK775", "economy", "02:50", 5500],
    ["Hyderabad", "Delhi", "Indigo", "6E209", "economy", "02:25", 4700],
  ];

  const insertItem = db.prepare(
    "INSERT INTO items (item_key, source_city, destination_city, airline, flight, travel_class, duration, degraded) VALUES (?,?,?,?,?,?,?,?)"
  );
  const insertSnapshot = db.prepare(
    "INSERT INTO snapshots (ts, item_key, price) VALUES (?,?,?)"
  );
  const insertDelta = db.prepare(
    "INSERT INTO deltas (ts, item_key, old_price, new_price, pct_change, direction) VALUES (?,?,?,?,?,?)"
  );

  const now = Date.now();

  db.transaction(() => {
    routes.forEach(([src, dst, airline, flight, klass, dur, base]) => {
      const itemKey = `${src}-${dst}-${airline}-${klass}`.toLowerCase();
      const durHours = Number(dur.split(":")[0]) + Number(dur.split(":")[1]) / 60;
      insertItem.run(itemKey, src, dst, airline, flight, klass, durHours, 0);

      // Seed 24 historical snapshots (one every 10 minutes) so the chart
      // has shape on first load, with occasional ±2-6% moves.
      let price = base;
      const points = 24;
      for (let i = 0; i < points; i++) {
        const ts = new Date(now - (points - i) * 10 * 60 * 1000).toISOString();
        if (i > 0) {
          const drift = (Math.random() - 0.5) * 0.06;
          price = Math.max(Math.round(price * (1 + drift) * 100) / 100, 500);
        }
        insertSnapshot.run(ts, itemKey, price);
        if (i > 0) {
          const prevRow = db
            .prepare(
              "SELECT price FROM snapshots WHERE item_key = ? AND ts < ? ORDER BY ts DESC LIMIT 1"
            )
            .get(itemKey, ts) as { price: number } | undefined;
          if (prevRow) {
            const prev = prevRow.price;
            if (price !== prev) {
              insertDelta.run(
                ts,
                itemKey,
                prev,
                price,
                Math.round(((price - prev) / prev) * 10000) / 100,
                price > prev ? "up" : "down"
              );
            }
          }
        }
      }
    });
  })();
}

export function runPollCycle(): number {
  ensureSeeded();
  const db = conn();

  const lastPrices = db
    .prepare(
      `
      SELECT s.item_key, s.price
      FROM snapshots s
      WHERE s.id IN (SELECT MAX(id) FROM snapshots GROUP BY item_key)
      `
    )
    .all() as LastPrice[];

  if (lastPrices.length === 0) return 0;

  const ts = new Date().toISOString();
  const insertSnapshot = db.prepare(
    "INSERT INTO snapshots (ts, item_key, price) VALUES (?,?,?)"
  );
  const insertDelta = db.prepare(
    "INSERT INTO deltas (ts, item_key, old_price, new_price, pct_change, direction) VALUES (?,?,?,?,?,?)"
  );

  let newDeltas = 0;

  db.transaction(() => {
    for (const { item_key, price } of lastPrices) {
      let next = price;

      if (Math.random() < MOVE_PROBABILITY) {
        next = nextPrice(price);
      }

      insertSnapshot.run(ts, item_key, next);

      if (next !== price) {
        insertDelta.run(
          ts,
          item_key,
          price,
          next,
          Math.round(((next - price) / price) * 10000) / 100,
          next > price ? "up" : "down"
        );
        newDeltas++;
      }
    }
  })();

  return newDeltas;
}