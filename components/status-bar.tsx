"use client";

import { useEffect, useState } from "react";

import { formatClock } from "@/lib/format";

interface StatusBarProps {
  totalRoutes: number;
  degradedCount: number;
  connected: boolean;
}

export function StatusBar({ totalRoutes, degradedCount, connected }: StatusBarProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setNow(new Date()));
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(tick);
    };
  }, []);

  const utc = now ? now.toISOString().replace("T", " ").slice(0, 19) : "----.--.-- --:--:--";
  const health = degradedCount === 0 ? "ALL SYSTEMS NOMINAL" : `${degradedCount} DEGRADED · HEAL IN PROGRESS`;

  return (
    <header className="relative z-10 mx-auto mt-4 w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="glass lift flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 sm:gap-5 sm:px-5">
        {/* feed state — on-air pill */}
        {connected ? (
          <span className="flex items-center gap-2 rounded-full bg-amber/10 px-3 py-1.5 ring-1 ring-inset ring-amber/25">
            <span className="animate-breathe relative inline-flex h-2 w-2 rounded-full bg-amber">
              <span className="absolute inset-0 rounded-full bg-amber/40 blur-[3px]" />
            </span>
            <span className="font-display text-[11px] font-semibold tracking-[0.25em] text-amber">
              ON AIR
            </span>
          </span>
        ) : (
          <span className="animate-flicker flex items-center gap-2 rounded-full bg-stalled/15 px-3 py-1.5 ring-1 ring-inset ring-stalled/40">
            <span className="inline-block h-2 w-2 rounded-full bg-stalled" />
            <span className="font-display text-[11px] font-semibold tracking-[0.25em] text-stalled">
              RECONNECTING
            </span>
          </span>
        )}

        <div className="hidden h-5 w-px bg-white/10 sm:block" />

        {/* route count */}
        <span className="font-data text-[11px] tracking-[0.18em] text-muted">
          <span className="text-base font-semibold text-secondary tabular-nums">{totalRoutes}</span>
          <span className="ml-1.5">ROUTES</span>
        </span>

        <span className="hidden h-5 w-px bg-white/10 sm:block" />

        <span className="font-data text-[11px] tracking-[0.18em] text-muted">
          <span
            className={
              degradedCount > 0
                ? "text-base font-semibold tabular-nums text-rise"
                : "text-base font-semibold tabular-nums text-drop"
            }
          >
            {degradedCount}
          </span>
          <span className="ml-1.5">DEGRADED</span>
        </span>

        {/* health status — only on lg+ */}
        <span className="hidden font-data text-[10px] tracking-[0.25em] text-faint lg:inline">
          <span className="text-faint/60">{"//"}</span> {health}
        </span>

        <span className="ml-auto flex items-center gap-4">
          <span className="hidden font-data text-[10px] tracking-[0.25em] text-faint md:inline">
            UTC {utc}Z
          </span>
          <span className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-1.5 ring-1 ring-inset ring-white/5">
            <span className="font-data text-base font-semibold tabular-nums tracking-[0.08em] text-primary">
              {now ? formatClock(now) : "--:--:--"}
            </span>
            <span className="inline-block h-3.5 w-1 -mb-0.5 bg-amber animate-blink" />
            <span className="font-data text-[9px] tracking-[0.3em] text-muted">LOCAL</span>
          </span>
        </span>
      </div>

      {/* runway edge lights */}
      <div className="runway-strip mt-3.5" aria-hidden />
    </header>
  );
}