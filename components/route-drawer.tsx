"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  airlineName,
  classTag,
  cityCode,
  formatClock,
  formatDuration,
  formatPct,
  formatPrice,
} from "@/lib/format";
import type { BoardItem, DeltaEvent } from "@/lib/types";

interface RouteDrawerProps {
  item: BoardItem | null;
  onClose: () => void;
}

interface HistoryPoint {
  ts: string;
  price: number;
}

interface HistoryResponse {
  history: HistoryPoint[];
  deltas: DeltaEvent[];
}

export function RouteDrawer({ item, onClose }: RouteDrawerProps) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [synced, setSynced] = useState<{ key: string; price: number } | null>(
    null
  );

  const itemKey = item?.item_key ?? null;
  const itemPrice = item?.price;

  useEffect(() => {
    if (!itemKey || itemPrice === undefined) return;
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(
          `/api/history?item_key=${encodeURIComponent(itemKey)}`,
          { signal: controller.signal, cache: "no-store" }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as HistoryResponse;
        if (!controller.signal.aborted) {
          setData(payload);
          setSynced({ key: itemKey, price: itemPrice });
        }
      } catch {
        // Aborted or transient failure.
      }
    })();

    return () => controller.abort();
  }, [itemKey, itemPrice]);

  const loading = Boolean(itemKey) && synced?.key !== itemKey;

  useEffect(() => {
    if (!item) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [item]);

  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
          />

          <motion.aside
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Fare details for ${cityCode(item.source_city)} to ${cityCode(item.destination_city)}`}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-hidden border-l border-white/10 bg-canvas/95 shadow-[-40px_0_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.36, ease: [0.22, 0.9, 0.3, 1] }}
          >
            <DrawerBody item={item} data={data} loading={loading} onClose={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------------- */

function DrawerBody({
  item,
  data,
  loading,
  onClose,
}: {
  item: BoardItem;
  data: HistoryResponse | null;
  loading: boolean;
  onClose: () => void;
}) {
  const accent = item.degraded
    ? "var(--stalled)"
    : item.direction === "down"
      ? "var(--fare-drop)"
      : item.direction === "up"
        ? "var(--fare-rise)"
        : "var(--edge-amber)";

  const chartData = useMemo(
    () =>
      data?.history.map((point, index) => ({
        t: index,
        label: formatClock(point.ts),
        price: point.price,
      })) ?? [],
    [data]
  );

  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return { first: item.price, min: item.price, max: item.price, drift: 0, driftPct: 0, moves: 0 };
    }
    const prices = chartData.map((p) => p.price);
    const first = prices[0];
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const drift = item.price - first;
    const driftPct = first !== 0 ? (drift / first) * 100 : 0;
    return { first, min, max, drift, driftPct, moves: chartData.length };
  }, [chartData, item.price]);

  return (
    <div className="flex min-h-full flex-col">
      {/* header */}
      <div className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent p-6 pb-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-25 blur-3xl"
          style={{ background: accent }}
        />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="font-data text-[10px] tracking-[0.3em] text-faint">
              ROUTE {cityCode(item.source_city)} → {cityCode(item.destination_city)}
            </p>
            <h2 className="mt-2.5 font-display text-[26px] font-semibold leading-none tracking-[0.02em] text-primary sm:text-[28px]">
              {airlineName(item.airline)}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 font-body text-sm text-muted">
              <span className="font-data text-xs tracking-wider">{item.flight}</span>
              <span className="text-faint">·</span>
              <span className="chip">{classTag(item.travel_class)}</span>
              <span className="text-faint">·</span>
              <span className="font-data text-xs tracking-wider">{formatDuration(item.duration)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="group -mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] font-data text-base leading-none text-muted transition-all hover:border-amber/40 hover:bg-amber/10 hover:text-amber"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* live fare — focal element */}
        <div
          className="relative overflow-hidden rounded-2xl border bg-white/[0.02] p-5 backdrop-blur-md"
          style={{
            borderColor: `color-mix(in srgb, ${accent} 28%, transparent)`,
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-20 blur-2xl"
            style={{ background: accent }}
          />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="font-data text-[10px] tracking-[0.3em] text-faint">
                CURRENT FARE
              </p>
              <p
                className="mt-2 font-data text-[44px] font-semibold leading-none tracking-tight tabular-nums"
                style={{ color: item.degraded ? undefined : accent }}
              >
                {item.degraded ? (
                  <span className="redacted-price">{"\u2593\u2593\u2593\u2593\u2593\u2593"}</span>
                ) : (
                  formatPrice(item.price)
                )}
              </p>
              {!item.degraded && (
                <p className="mt-3 flex items-center gap-1.5 font-data text-xs">
                  {Math.abs(stats.driftPct) > 0.05 ? (
                    <span
                      style={{
                        color: stats.drift >= 0 ? "var(--fare-rise)" : "var(--fare-drop)",
                      }}
                    >
                      {stats.drift >= 0 ? "▲" : "▼"} {formatPct(stats.driftPct)}
                    </span>
                  ) : (
                    <span className="text-muted">— flat</span>
                  )}
                  <span className="text-faint">since first snapshot</span>
                </p>
              )}
            </div>
            {item.degraded ? (
              <span
                className="chip"
                style={{
                  color: "var(--stalled)",
                  borderColor: "color-mix(in srgb, var(--stalled) 40%, transparent)",
                  background: "rgba(107, 119, 145, 0.14)",
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-stalled animate-pulse-soft" />
                SIGNAL LOST
              </span>
            ) : item.direction ? (
              <span
                className="chip"
                style={{
                  color: accent,
                  borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
                  background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                }}
              >
                {item.direction === "up" ? "▲" : "▼"} {formatPct(item.lastPct ?? 0)}
              </span>
            ) : (
              <span className="chip">
                <span className="h-1.5 w-1.5 rounded-full bg-amber animate-pulse-soft" />
                TRACKED
              </span>
            )}
          </div>
        </div>

        {/* quick stats row */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <StatCell label="LOW" value={formatPrice(stats.min)} tone="drop" />
          <StatCell label="HIGH" value={formatPrice(stats.max)} tone="rise" />
          <StatCell label="SNAPS" value={String(stats.moves)} tone="amber" />
        </div>

        {/* sparkline */}
        <section className="mt-7">
          <div className="flex items-center justify-between">
            <h3 className="font-data text-[10px] tracking-[0.3em] text-muted">
              FARE HISTORY
            </h3>
            <span className="font-data text-[10px] tracking-[0.25em] text-faint">
              {chartData.length} POINTS
            </span>
          </div>
          <div className="mt-3 h-52 rounded-2xl border border-white/5 bg-white/[0.015] p-3 backdrop-blur-sm">
            {loading && !data ? (
              <div className="flex h-full items-end gap-1" aria-hidden>
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse flex-1 rounded-t-sm bg-raised"
                    style={{ height: `${25 + Math.sin(i * 1.7) * 18 + 18}%` }}
                  />
                ))}
              </div>
            ) : chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 6, bottom: 0, left: 6 }}>
                  <defs>
                    <linearGradient id="fareFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={accent} stopOpacity={0.38} />
                      <stop offset="100%" stopColor={accent} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fareStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={accent} stopOpacity={0.6} />
                      <stop offset="100%" stopColor={accent} stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide />
                  <YAxis domain={["auto", "auto"]} hide />
                  <ReferenceLine
                    y={stats.first}
                    stroke="var(--text-muted)"
                    strokeOpacity={0.25}
                    strokeDasharray="3 4"
                  />
                  <Tooltip
                    cursor={{
                      stroke: accent,
                      strokeDasharray: "3 3",
                      strokeOpacity: 0.45,
                    }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const point = payload[0].payload as { label: string; price: number };
                      return (
                        <div className="rounded-lg border border-white/10 bg-raised/95 px-2.5 py-1.5 font-data text-xs tabular-nums text-primary shadow-2xl backdrop-blur">
                          <span className="text-faint">{point.label}</span>
                          <span className="mx-1.5 text-faint">·</span>
                          <span style={{ color: accent }}>{formatPrice(point.price)}</span>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="url(#fareStroke)"
                    strokeWidth={2}
                    fill="url(#fareFill)"
                    isAnimationActive={false}
                    dot={false}
                    activeDot={{ r: 4, fill: accent, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center font-body text-sm text-muted">
                Not enough snapshots yet.
              </p>
            )}
          </div>
        </section>

        {/* recent deltas */}
        <section className="mt-7">
          <div className="flex items-center justify-between">
            <h3 className="font-data text-[10px] tracking-[0.3em] text-muted">
              RECENT ACTIVITY
            </h3>
            <span className="font-data text-[10px] tracking-[0.25em] text-faint">
              LAST {Math.min(data?.deltas.length ?? 0, 8)}
            </span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {data?.deltas.length ? (
              data.deltas.slice(0, 8).map((delta) => {
                const up = delta.direction === "up";
                return (
                  <li
                    key={delta.id}
                    className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5 font-data text-xs tabular-nums transition-colors hover:border-white/15 hover:bg-white/[0.04]"
                  >
                    <span className="w-14 shrink-0 text-faint">{formatClock(delta.ts)}</span>
                    <span className="flex-1 text-secondary">
                      {formatPrice(delta.old_price)}
                      <span className="mx-1.5 text-faint">→</span>
                      <span className="text-primary">{formatPrice(delta.new_price)}</span>
                    </span>
                    <span
                      className="w-16 shrink-0 text-right text-[11px] font-semibold"
                      style={{ color: up ? "var(--fare-rise)" : "var(--fare-drop)" }}
                    >
                      {up ? "▲" : "▼"} {formatPct(delta.pct_change)}
                    </span>
                  </li>
                );
              })
            ) : (
              <li className="rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-4 font-body text-sm text-muted">
                No fare movements recorded yet.
              </li>
            )}
          </ul>
        </section>

        {/* demo control */}
        <footer className="mt-8">
          <SignalLossToggle item={item} />
        </footer>
      </div>
    </div>
  );
}

function StatCell({ label, value, tone }: { label: string; value: string; tone: "drop" | "rise" | "amber" }) {
  const color =
    tone === "drop" ? "var(--fare-drop)" : tone === "rise" ? "var(--fare-rise)" : "var(--edge-amber)";
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 backdrop-blur-sm">
      <p className="font-data text-[10px] tracking-[0.3em] text-faint">{label}</p>
      <p className="mt-1.5 font-data text-[15px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function SignalLossToggle({ item }: { item: BoardItem }) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await fetch("/api/degraded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_key: item.item_key, degraded: !item.degraded }),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={item.degraded}
      disabled={busy}
      onClick={toggle}
      className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3.5 text-left transition-all hover:border-white/15 hover:bg-white/[0.04] disabled:opacity-60"
    >
      <span>
        <span className="block font-data text-[10px] tracking-[0.3em] text-faint">
          SCRAPE HEALTH
        </span>
        <span
          className="mt-1 block font-data text-xs font-semibold"
          style={{ color: item.degraded ? "var(--stalled)" : "var(--fare-drop)" }}
        >
          {item.degraded ? "SIGNAL LOST — AWAITING HEAL" : "NOMINAL"}
        </span>
      </span>

      <span
        aria-hidden
        className="relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors duration-200"
        style={{
          backgroundColor: item.degraded
            ? "rgba(107, 119, 145, 0.3)"
            : "color-mix(in srgb, var(--fare-drop) 25%, #233042)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full transition-all duration-200"
          style={{
            left: item.degraded ? "22px" : "3px",
            backgroundColor: item.degraded ? "#5d6580" : "var(--fare-drop)",
            boxShadow: item.degraded ? "none" : "0 0 10px var(--fare-drop-glow)",
          }}
        />
      </span>
    </button>
  );
}