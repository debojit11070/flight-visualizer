"use client";

import { useEffect, useState } from "react";

import { airlineName, cityCode, formatPct, formatPrice } from "@/lib/format";
import type { BoardItem, StreamEvent } from "@/lib/types";

interface TickerProps {
  items: BoardItem[];
}

interface TickerEntry {
  id: number;
  item_key: string;
  label: string;
  newPrice: number;
  pct: number;
  up: boolean;
}

const MAX_ENTRIES = 20;

export function Ticker({ items }: TickerProps) {
  const [entries, setEntries] = useState<TickerEntry[]>([]);

  useEffect(() => {
    const source = new EventSource("/api/stream");

    source.onmessage = (event) => {
      let parsed: StreamEvent;
      try {
        parsed = JSON.parse(event.data) as StreamEvent;
      } catch {
        return;
      }
      if (parsed.type !== "deltas") return;

      const itemMap = new Map(items.map((item) => [item.item_key, item]));
      setEntries((prev) => {
        const next: TickerEntry[] = [...prev];
        for (const delta of parsed.rows) {
          const item = itemMap.get(delta.item_key);
          if (!item) continue;
          next.unshift({
            id: delta.id,
            item_key: delta.item_key,
            label: `${airlineName(item.airline)} ${cityCode(item.source_city)}→${cityCode(item.destination_city)}`,
            newPrice: delta.new_price,
            pct: delta.pct_change,
            up: delta.direction === "up",
          });
        }
        if (next.length > MAX_ENTRIES) next.length = MAX_ENTRIES;
        return next;
      });
    };

    return () => source.close();
  }, [items]);

  if (entries.length === 0) {
    return (
      <div className="relative z-10 mx-auto mt-3 w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="glass flex items-center gap-3 rounded-2xl px-4 py-2.5">
          <span className="chip shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-amber animate-pulse-soft" />
            TICKER
          </span>
          <span className="truncate font-data text-[11px] tracking-[0.15em] text-muted">
            Awaiting first fare movement…
          </span>
        </div>
      </div>
    );
  }

  const loop = [...entries, ...entries];

  return (
    <div className="relative z-10 mx-auto mt-3 w-full max-w-6xl overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md sm:rounded-2xl">
      <div className="pointer-events-none absolute inset-y-0 left-12 z-10 w-20 bg-gradient-to-r from-canvas/90 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-canvas/90 to-transparent" />
      <div className="flex items-stretch">
        <span className="flex shrink-0 items-center gap-2 border-r border-white/5 bg-amber/10 px-3.5 py-3 font-data text-[10px] tracking-[0.3em] text-amber">
          <span className="h-1.5 w-1.5 rounded-full bg-amber animate-pulse-soft" />
          LIVE
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div className="marquee-track py-2.5 will-change-transform">
            {loop.map((entry, idx) => (
              <span
                key={`${entry.id}-${idx}`}
                className="mx-6 inline-flex shrink-0 items-center gap-2.5 font-data text-[12px] tracking-[0.06em]"
              >
                <span className="text-faint/70">▸</span>
                <span className="text-secondary">{entry.label}</span>
                <span className="text-faint/60">·</span>
                <span style={{ color: entry.up ? "var(--fare-rise)" : "var(--fare-drop)" }}>
                  {formatPrice(entry.newPrice)}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
                  style={{
                    color: entry.up ? "var(--fare-rise)" : "var(--fare-drop)",
                    backgroundColor: entry.up
                      ? "color-mix(in srgb, var(--fare-rise) 14%, transparent)"
                      : "color-mix(in srgb, var(--fare-drop) 14%, transparent)",
                    border: `1px solid color-mix(in srgb, ${entry.up ? "var(--fare-rise)" : "var(--fare-drop)"} 35%, transparent)`,
                  }}
                >
                  {entry.up ? "▲" : "▼"} {formatPct(entry.pct)}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}