"use client";

import { useEffect, useState } from "react";

import { RouteDrawer } from "@/components/route-drawer";
import { RouteTile } from "@/components/route-tile";
import { StatusBar } from "@/components/status-bar";
import { Ticker } from "@/components/ticker";
import type { BoardItem, DeltaEvent, StreamEvent } from "@/lib/types";

interface RouteBoardProps {
  initialItems: BoardItem[];
}

export function RouteBoard({ initialItems }: RouteBoardProps) {
  const [items, setItems] = useState<BoardItem[]>(initialItems);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource("/api/stream");

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    source.onmessage = (event) => {
      let parsed: StreamEvent;
      try {
        parsed = JSON.parse(event.data) as StreamEvent;
      } catch {
        return;
      }

      if (parsed.type === "deltas") {
        const latest = new Map<string, DeltaEvent>();
        for (const delta of parsed.rows) latest.set(delta.item_key, delta);

        setItems((prev) =>
          prev.map((item) => {
            const delta = latest.get(item.item_key);
            return delta
              ? {
                  ...item,
                  price: delta.new_price,
                  ts: delta.ts,
                  direction: delta.direction,
                  lastPct: delta.pct_change,
                }
              : item;
          })
        );
      } else if (parsed.type === "state") {
        setItems((prev) =>
          prev.map((item) => ({
            ...item,
            degraded: Boolean(parsed.degraded[item.item_key]),
          }))
        );
      }
    };

    return () => source.close();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const degradedCount = items.filter((item) => item.degraded).length;
  const selected =
    items.find((item) => item.item_key === selectedKey) ?? null;

  return (
    <div className="relative">
      <StatusBar
        totalRoutes={items.length}
        degradedCount={degradedCount}
        connected={connected}
      />

      <div className="relative z-10 mx-auto mt-4 w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <Ticker items={items} />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        {/* hero */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-data text-[10px] tracking-[0.3em] text-faint">
              DEPARTURES · INDIA
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-semibold leading-tight tracking-tight text-primary sm:text-4xl md:text-[44px]">
              Live Fare Board
              <span className="ml-2 align-middle font-display text-base font-medium tracking-[0.05em] text-amber sm:text-lg">
                / Solari
              </span>
            </h1>
            <p className="mt-2 max-w-xl font-body text-sm leading-relaxed text-muted">
              Every flip is a fare that just moved — pulled live from the Bright Data scraper,
              self-healing on every poll cycle.
            </p>
          </div>
          <div className="flex items-center gap-2 self-end">
            <span className="chip">
              <span className="h-1.5 w-1.5 rounded-full bg-amber animate-pulse-soft" />
              {connected ? "STREAMING" : "OFFLINE"}
            </span>
            <span className="chip">SSE · 2s</span>
          </div>
        </div>

        {/* grid */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <RouteTile
              key={item.item_key}
              item={item}
              onSelect={() => setSelectedKey(item.item_key)}
            />
          ))}
        </div>

        {/* footer */}
        <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-6">
          <p className="font-data text-[10px] tracking-[0.3em] text-faint">
            <span className="text-primary">FLIGHT</span>
            <span className="text-amber">FARE</span>
            <span className="ml-3 text-faint/70">· SOLARI-STYLE BOARD</span>
          </p>
          <p className="font-data text-[10px] tracking-[0.3em] text-faint">
            POWERED BY BRIGHT DATA · {items.length} ROUTES
          </p>
        </footer>
      </main>

      <RouteDrawer item={selected} onClose={() => setSelectedKey(null)} />
    </div>
  );
}