# Flight Fare Visualizer — YouTube Demo Script (≤ 3 minutes)

> **Working title:** *Flight Fare — A Solari-Style Live Departure Board for the Web*
> **Suggested tags:** `nextjs`, `tailwindcss`, `framer-motion`, `recharts`, `sse`, `bright-data`, `webdev`, `hackathon`

---

## 🎬 Cold Open (0:00 – 0:20)

**[Visual: Screen recording of the live board ticking. Camera slowly pushes in on a tile as a price flips.]**

> *"Every airport has one — the split-flap departure board. The one interface everyone recognizes but nobody builds anymore. We built one. For flight fares. Live."*

**[On-screen text: FlightFare · Solari-style live board · Bright Data]**

---

## 1. About the Project (0:20 – 0:50)

**[Visual: Wide shot of the full board. Tiles flipping, ticker scrolling, ON AIR pulse.]**

> *"FlightFare is a real-time departure board for airfare. A self-healing scraper feeds us fares every few seconds; when a price moves, the tile literally **flips** — the same mechanical motion a Solari board uses. When the scraper breaks, tiles stall and flicker to show a degraded pipeline, and the moment it heals they snap back to color."*

**[B-roll: cursor clicking a tile → drawer slides in with sparkline + recent activity.]**

> *"Click a route and you get a full price history, deltas, and a live toggle to simulate the heal cycle — so the demo always works, even without the live scraper running."*

**Key things to mention:**
- Live fare tracking for Indian domestic routes
- Mechanical split-flap animation as the signature interaction
- Self-healing visual states (NOMINAL / SIGNAL LOST)
- Drawer with sparkline + recent activity + scrape-health toggle

---

## 2. Tech Stack & Architecture (0:50 – 1:35)

**[Visual: Animated diagram overlay OR clean terminal/IDE shot.]**

> *"Everything is one Next.js app — frontend, backend, and real-time streaming."*

**Stack callouts (overlay one by one):**
- **Next.js 16** (App Router) — server components for the initial paint, route handlers for the API
- **TypeScript** end-to-end
- **Tailwind CSS v4** — custom design tokens, no UI kit
- **Framer Motion** — the 3D split-flap `rotateX` flip
- **Recharts** — sparkline in the detail drawer
- **better-sqlite3** — reads `fixture.db` directly (the same schema the real scraper will write to)
- **Server-Sent Events** — pushes deltas + degraded-state flags to the browser

**Architecture (single image / diagram overlay):**

```
Bright Data Scraper
        │
        ▼
POST /api/poll  ──►  snapshots + deltas + items (SQLite)
                          │
                          ▼
GET  /api/stream  ──►  SSE: { type: "deltas" | "state" }
                          │
                          ▼
                  <RouteBoard> client
                  ├── <StatusBar>    ON AIR pill, route count, clock
                  ├── <Ticker>       live marquee of every fare move
                  ├── <RouteTile>×N  flip-tile grid (Solari-style)
                  └── <RouteDrawer>  slide-in: sparkline + deltas + heal toggle
```

> *"The same DB schema is shared by the fixture and the live poller — so swapping in Bright Data is one config flag, no UI changes."*

---

## 3. Demo (1:35 – 2:30)

**[Live screen recording with voice-over. Pre-load 2-3 stale items + 1 degraded tile in the DB so the demo shows multiple states.]**

### 3a · The flip (1:35 – 1:55)

> *"Watch the tiles — when a fare moves, they flip in 3D, like real split-flap."*

- Show 2–3 tiles flipping in sequence
- Point out the corner-glow + edge bloom + redacted price flash
- Hover a tile → lift, glow intensifies

### 3b · Live ticker (1:55 – 2:05)

> *"Every movement also lands in the live ticker — the only feed in the UI that's always moving."*

- Camera pans to the marquee strip
- Show both up/down colors

### 3c · Drawer + sparkline (2:05 – 2:20)

> *"Click any tile and you get the full fare history."*

- Click a tile → drawer slides in
- Hover the chart to show custom tooltip
- Scroll through the recent activity feed

### 3d · The self-healing moment (2:20 – 2:30)

> *"And the signature demo: a tile loses signal — see the flicker, see the desaturated slate — flip the toggle in the drawer to simulate the heal, and watch the tile **snap back to full color**."*

- Open drawer for a degraded tile
- Click SCRAPE HEALTH toggle
- Drawer closes (or stays) → tile flips back to its accent color, status bar drops the degraded count

---

## 4. Learning & Growth (2:30 – 2:55)

> *"A few things this build taught us."*

- **Schema-stable integration beats code-coupled integration.** Keeping `items / snapshots / deltas` identical between fixture and live scraper means the UI never has to change when we swap data sources.
- **Solari mechanics in the browser** — the visible face is held by React state and swapped exactly at the edge-on point of a `rotateX` rotation, so digits never morph.
- **`prefers-reduced-motion`** is honored: the 3D flip collapses to a clean cross-fade.
- **One SSE stream, multiple event types** (`deltas` for fares, `state` for degraded flags) keeps the wire format clean.
- **Glass + ambient mesh > pure flat dark** — the runway palette got 10× more premium the moment we added layered radial gradients + backdrop-blur on tiles.

---

## Closing (2:55 – 3:00)

**[Visual: Pull back to full board. ON AIR pulse, ticker scrolling, gentle scanline sweep.]**

> *"FlightFare — a Solari board for the modern web. Built with Next.js, Framer Motion, and a stubborn refusal to use a stock-ticker UI."*

**[End card: GitHub repo link + team credits]**

---

## 📋 Production Checklist

- [ ] Demo data pre-loaded: ≥ 2 routes with fresh deltas, 1 degraded tile, ≥ 50 history points for the clicked route
- [ ] Dev server running on a clean URL (no leftover console logs / debug overlays)
- [ ] Browser zoom at 100%, window 1440×900 or larger for the wide shots
- [ ] Mic check — quiet room, no keyboard clacking
- [ ] Optional: enable `prefers-reduced-motion` for one cut to demo the fallback
- [ ] OBS / screen recorder set to 1080p, 30fps, no system notifications visible

## 🎯 Suggested On-Screen Captions

| Timestamp | Caption |
| --- | --- |
| 0:05 | **Split-flap board for flight fares** |
| 0:25 | **Live · self-healing · Solari-style** |
| 0:55 | **One Next.js app · end-to-end** |
| 1:40 | **Every flip = a fare that just moved** |
| 2:25 | **Signal lost → heal → snap back** |

---

*Total runtime target: **2:55 – 3:00** with 5–10 s of breathing room.*