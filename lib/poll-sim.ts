import db from "@/lib/db";

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

export function runPollCycle(): number {
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
