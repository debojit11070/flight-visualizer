# Flight Fare Visualizer — Next.js Build Spec
### UI-first technical reference · Into the Scrape-Verse Hackathon

Data question is closed: `fixture.db` is seeded and working. This doc is everything needed to build the actual app — design system first, then architecture, then component-by-component.

---

## 1. Design Direction

The subject is a live departure board — the one thing every airport has that nobody else's product category does. That's the signature to build around, not a generic dashboard or stock-ticker look.

**Signature element:** route tiles that *flip* like a split-flap (Solari) board when a price changes — not a generic fade/pulse. This is the one bold, orchestrated moment; everything else stays quiet around it.

### Design Tokens

**Color** — a night-runway palette, not the default cream/terracotta or near-black/acid-green look:

| Token | Hex | Use |
|---|---|---|
| `--bg-base` | `#0A0E17` | App background — night sky over tarmac |
| `--bg-panel` | `#12182A` | Card/tile surface |
| `--bg-panel-raised` | `#1A2238` | Hovered/active tile |
| `--edge-amber` | `#FFB020` | Runway-edge-lighting accent — borders, focus states, the signature glow |
| `--fare-drop` | `#2ED9A0` | Price decreased (good news, nav-light green) |
| `--fare-rise` | `#E8556B` | Price increased (obstruction-light red) |
| `--stalled` | `#4B5568` | Degraded/no-data state, desaturated slate |
| `--text-primary` | `#EDF1F7` | Primary text |
| `--text-muted` | `#8B93A7` | Secondary text, timestamps |

**Type:**
- **Display / labels:** `Space Grotesk` — technical, slightly geometric, reads like signage rather than a generic web sans
- **Body:** `Inter` — quiet workhorse for anything longer than a label
- **Data / prices / timestamps:** `JetBrains Mono` with tabular figures — real flight-information-display systems are monospace so digits don't jitter as they change; use this deliberately for every number in the UI

**Layout concept:**
```
┌────────────────────────────────────────────┐
│  ▌LIVE▐  8 routes tracked · 1 degraded      │  ← status bar, terminal-signage tone
├────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌───────┐│
│  │DAC→CGP │ │DAC→ZYL │ │DAC→CXB │ │DAC→JSR││  ← flip-tile grid
│  │ ৳3,450 ▲│ │ ৳2,100  │ │ ▓▓▓▓▓▓ │ │৳4,800▼││
│  └────────┘ └────────┘ └────────┘ └───────┘│
├────────────────────────────────────────────┤
│  [tap a tile → slide-in drawer: sparkline]  │
└────────────────────────────────────────────┘
```
No numbered markers, no decorative dividers — the route codes themselves (DAC→CGP) are the only structural labels needed, and they carry real information.

**Motion:**
- Tile flip on price change: 3D `rotateX` transform, ~400ms, easing that overshoots slightly then settles — mimics the mechanical snap of a real split-flap tile
- Degraded state: a subtle desync flicker (opacity jitter, ~2s loop) rather than a spinner — reads as "signal lost," not "loading"
- Heal recovery: the flip animation plays once, tile snaps back to full color — this is the money shot for your demo video
- Respect `prefers-reduced-motion`: fall back to a plain cross-fade, no 3D transform

---

## 2. Architecture

Next.js does both frontend and backend — no separate server needed.

```
┌─────────────────────┐
│  Bright Data          │  bdata scraper run / heal
│  Scraper Studio       │
└──────────┬───────────┘
           │ POST /dca/trigger
           ▼
┌───────────────────────────────────────────┐
│  Next.js App Router                         │
│                                              │
│  app/api/poll/route.ts     — cron-triggered,│
│    calls Bright Data, diffs vs last         │
│    snapshot, writes DB, marks degraded      │
│                                              │
│  app/api/stream/route.ts   — SSE endpoint,  │
│    pushes new delta rows to the browser     │
│                                              │
│  app/page.tsx              — the board       │
│  components/route-tile.tsx — flip tile       │
│  components/status-bar.tsx                   │
│  components/route-drawer.tsx — sparkline     │
│                                              │
│  lib/db.ts — better-sqlite3, same schema     │
│    as fixture.db (items / snapshots / deltas)│
└───────────────────────────────────────────┘
```

Today: `app/api/stream/route.ts` reads from `fixture.db`. Later: `app/api/poll/route.ts` writes real scraper output into the same tables, and nothing downstream changes. This is the whole point of keeping schemas identical.

---

## 3. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15, App Router |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui — `Card`, `Badge`, `Sheet`, `Tooltip`, `Skeleton` |
| Animation | Framer Motion (`motion.div` with `rotateX`) |
| Real-time | Server-Sent Events via a Route Handler `ReadableStream` |
| DB (dev) | SQLite / `better-sqlite3`, reading `fixture.db` directly |
| DB (prod) | Postgres — swap the `lib/db.ts` connection via env var, schema unchanged |
| Charts | Recharts, for the sparkline in the drawer |
| Fonts | `next/font/google` — Space Grotesk, Inter, JetBrains Mono |

---

## 4. Project Setup

```bash
npx create-next-app@latest flight-visualizer \
  --typescript --tailwind --app --src-dir=false --import-alias "@/*"

cd flight-visualizer
npx shadcn@latest init
npx shadcn@latest add card badge sheet tooltip skeleton

npm install better-sqlite3 framer-motion recharts
npm install -D @types/better-sqlite3
```

Copy your seeded `fixture.db` into the project root (or `/data`), and point `lib/db.ts` at it.

---

## 5. File-by-File Breakdown

### `lib/db.ts`
```ts
import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "fixture.db"));

export function getLatestByItem() {
  return db.prepare(`
    SELECT s.item_key, s.price, s.ts, i.source_city, i.destination_city,
           i.airline, i.travel_class
    FROM snapshots s
    JOIN items i ON i.item_key = s.item_key
    WHERE s.id IN (
      SELECT MAX(id) FROM snapshots GROUP BY item_key
    )
  `).all();
}

export function getRecentDeltas(sinceId: number) {
  return db.prepare(`SELECT * FROM deltas WHERE id > ? ORDER BY id ASC`).all(sinceId);
}

export function getHistoryForItem(itemKey: string) {
  return db.prepare(`
    SELECT ts, price FROM snapshots WHERE item_key = ? ORDER BY ts ASC
  `).all(itemKey);
}

export default db;
```

### `app/api/stream/route.ts` — SSE endpoint
```ts
import { getRecentDeltas } from "@/lib/db";

export async function GET() {
  const encoder = new TextEncoder();
  let lastId = 0;

  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        const deltas = getRecentDeltas(lastId);
        if (deltas.length > 0) {
          lastId = Math.max(...deltas.map((d: any) => d.id));
          const payload = `data: ${JSON.stringify(deltas)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        }
      }, 2000);

      // cleanup on client disconnect
      return () => clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

### `app/page.tsx` — the board
```tsx
import { getLatestByItem } from "@/lib/db";
import { StatusBar } from "@/components/status-bar";
import { RouteBoard } from "@/components/route-board";

export default function Page() {
  const items = getLatestByItem();

  return (
    <main className="min-h-screen bg-[--bg-base] text-[--text-primary] p-6">
      <StatusBar totalRoutes={items.length} />
      <RouteBoard initialItems={items} />
    </main>
  );
}
```

### `components/route-board.tsx` — client component, owns the SSE subscription
```tsx
"use client";

import { useEffect, useState } from "react";
import { RouteTile } from "@/components/route-tile";
import { RouteDrawer } from "@/components/route-drawer";

export function RouteBoard({ initialItems }: { initialItems: any[] }) {
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = (e) => {
      const deltas = JSON.parse(e.data);
      setItems((prev) =>
        prev.map((item) => {
          const delta = deltas.find((d: any) => d.item_key === item.item_key);
          return delta
            ? { ...item, price: delta.new_price, direction: delta.direction, justChanged: true }
            : item;
        })
      );
    };
    return () => es.close();
  }, []);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
        {items.map((item) => (
          <RouteTile key={item.item_key} item={item} onClick={() => setSelected(item.item_key)} />
        ))}
      </div>
      <RouteDrawer itemKey={selected} onClose={() => setSelected(null)} />
    </>
  );
}
```

### `components/route-tile.tsx` — the flip-tile, the signature element
```tsx
"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function RouteTile({ item, onClick }: { item: any; onClick: () => void }) {
  const stateColor =
    item.direction === "down" ? "var(--fare-drop)"
    : item.direction === "up" ? "var(--fare-rise)"
    : item.degraded ? "var(--stalled)"
    : "var(--edge-amber)";

  return (
    <motion.div
      onClick={onClick}
      animate={item.justChanged ? { rotateX: [0, 90, 0] } : {}}
      transition={{ duration: 0.4, ease: "backOut" }}
      style={{ perspective: 600 }}
      className="cursor-pointer"
    >
      <Card
        className="bg-[--bg-panel] border-2 p-4 font-mono"
        style={{ borderColor: stateColor }}
      >
        <div className="flex justify-between items-center">
          <span className="font-sans text-sm text-[--text-muted]">
            {item.source_city} → {item.destination_city}
          </span>
          <Badge variant="outline">{item.airline}</Badge>
        </div>
        <div className="text-2xl mt-2 tabular-nums" style={{ color: stateColor }}>
          ৳{item.price.toLocaleString()}
        </div>
      </Card>
    </motion.div>
  );
}
```

### `components/status-bar.tsx`
Terminal-signage tone — this is where the degraded/healed count lives, the on-screen indicator for your self-healing demo moment. Reads current degraded count from state passed down from `route-board`, or via its own light SSE subscription filtered to `degraded` events.

### `components/route-drawer.tsx`
shadcn `<Sheet>`, slides in on tile click. Fetches `getHistoryForItem(itemKey)` via a small API route, renders a Recharts `<LineChart>` sparkline plus the last 5 deltas as a compact list underneath.

---

## 6. The Self-Healing Demo, In UI Terms

This is the sequence your `<StatusBar>` and `<RouteTile>` degraded state need to support, matching the plan from the earlier spec:

1. Board runs normally — tiles occasionally flip, status bar reads "Live · 0 degraded"
2. Break the scraper (bad extraction rule, or a real site change)
3. Affected tile(s) shift to the `--stalled` slate color with the flicker-jitter animation; status bar updates to "N degraded"
4. Run `bdata scraper heal` on screen
5. Next poll cycle: tile flips back to full color, status bar returns to "Live · 0 degraded"

Build the degraded state and the status bar count *before* touching the real scraper — test it by manually inserting a fake `degraded` flag into `fixture.db`, so the UI is demo-ready independent of Bright Data timing.

---

## 7. Build Order

1. Scaffold project, install deps, confirm shadcn components render
2. `lib/db.ts` against `fixture.db`, confirm `getLatestByItem()` returns real rows
3. Static `page.tsx` + `route-tile.tsx` with no animation yet — get the grid looking right first
4. Add the SSE stream + `route-board.tsx` subscription — confirm tiles update live from `fixture.db` deltas
5. Add the flip animation, tune timing/easing until it feels mechanical, not bouncy
6. Build `route-drawer.tsx` + sparkline
7. Add the degraded/stalled visual state, test with a manually-inserted fake degraded row
8. Swap `fixture.db` for the live Bright Data poller once the collector is working
9. Polish: focus states, `prefers-reduced-motion` fallback, mobile grid breakpoints
