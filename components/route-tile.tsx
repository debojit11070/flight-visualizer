"use client";

import {
  motion,
  useAnimationControls,
  useReducedMotion,
} from "framer-motion";
import { useEffect, useState } from "react";

import {
  airlineName,
  cityCode,
  classTag,
  formatDuration,
  formatPct,
  formatPrice,
} from "@/lib/format";
import type { BoardItem } from "@/lib/types";

const FLIP_MS = 440;
const SWAP_AT_MS = 190;

interface RouteTileProps {
  item: BoardItem;
  onSelect: () => void;
}

export function RouteTile({ item, onSelect }: RouteTileProps) {
  const reduceMotion = useReducedMotion();

  const [shown, setShown] = useState(item);
  const [hovered, setHovered] = useState(false);
  const flipControls = useAnimationControls();
  const flashControls = useAnimationControls();

  const trigger = `${item.price}|${item.degraded}`;
  const shownTrigger = `${shown.price}|${shown.degraded}`;

  useEffect(() => {
    if (trigger === shownTrigger) return;

    if (reduceMotion) {
      void flipControls.start(
        { rotateX: 0, opacity: [null, 0.35, 1] },
        { duration: FLIP_MS / 1000, times: [0, 0.5, 1] }
      );
    } else {
      void flipControls.start(
        { rotateX: [null, -93, 0], opacity: 1 },
        {
          duration: FLIP_MS / 1000,
          times: [0, 0.5, 1],
          ease: ["easeIn", "backOut"],
        }
      );
    }

    void flashControls.start(
      { opacity: [0, 0.9, 0] },
      { duration: FLIP_MS / 1000 + 0.35, times: [0, 0.22, 1] }
    );

    const swapTimer = setTimeout(
      () => setShown(item),
      reduceMotion ? 0 : SWAP_AT_MS
    );
    return () => clearTimeout(swapTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const accent = item.degraded
    ? "var(--stalled)"
    : item.direction === "down"
      ? "var(--fare-drop)"
      : item.direction === "up"
        ? "var(--fare-rise)"
        : "var(--edge-amber)";

  const arrow =
    item.direction === "down" ? "▼" : item.direction === "up" ? "▲" : null;
  const pct = item.direction ? Math.abs(shown.lastPct ?? 0) : null;

  const shortKey = (shown.item_key || "").split("-").pop()?.toUpperCase().slice(-4) ?? "----";

  return (
    <motion.div style={{ transformPerspective: 900 }}>
      <motion.button
        type="button"
        onClick={onSelect}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={`${airlineName(shown.airline)} ${cityCode(shown.source_city)} to ${cityCode(shown.destination_city)}, ${item.degraded ? "signal lost" : formatPrice(shown.price)}`}
        animate={flipControls}
        className="group flap-seam lift relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white/[0.02] p-4 text-left ring-1 ring-inset ring-white/[0.04] backdrop-blur-md transition-colors duration-300 sm:p-5"
        style={{
          borderColor: `color-mix(in srgb, ${accent} ${hovered ? 75 : 32}%, transparent)`,
          boxShadow: hovered
            ? `0 18px 40px -18px rgba(0,0,0,0.9), 0 0 36px -10px color-mix(in srgb, ${accent} 40%, transparent)`
            : `0 8px 24px -14px rgba(0,0,0,0.7)`,
        }}
      >
        {/* change flash — runway-light bloom */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            boxShadow: `inset 0 0 32px -8px ${accent}, 0 0 28px -8px ${accent}`,
            opacity: 0,
          }}
          animate={flashControls}
        />

        {/* accent corner glow — adds color life */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-50 blur-2xl transition-opacity duration-500 group-hover:opacity-80"
          style={{ background: accent }}
        />

        <span
          className={
            item.degraded
              ? "animate-flicker relative flex flex-1 flex-col"
              : "relative flex flex-1 flex-col"
          }
        >
          {/* top row: flight tag + class chip */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-data text-[10px] tracking-[0.28em] text-faint">
              FLT <span className="ml-1 text-secondary tabular-nums">{shortKey}</span>
            </span>
            <span className="chip">
              {classTag(shown.travel_class)}
            </span>
          </div>

          {/* route codes — the structural label */}
          <div className="mt-4 flex items-center gap-2 font-display text-[24px] font-semibold tracking-[0.04em] text-primary sm:text-[26px]">
            <span>{cityCode(shown.source_city)}</span>
            <span
              className="inline-flex h-px flex-1 items-center justify-center"
              aria-hidden
            >
              <span
                className="block h-1 w-1 rounded-full"
                style={{ background: accent, opacity: 0.7 }}
              />
              <span
                className="mx-1 block h-px flex-1"
                style={{
                  background: `linear-gradient(to right, color-mix(in srgb, ${accent} 60%, transparent), transparent)`,
                }}
              />
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 5h8M6 1l3 4-3 4" stroke={accent} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span
                className="mx-1 block h-px flex-1"
                style={{
                  background: `linear-gradient(to left, color-mix(in srgb, ${accent} 60%, transparent), transparent)`,
                }}
              />
              <span
                className="block h-1 w-1 rounded-full"
                style={{ background: accent, opacity: 0.7 }}
              />
            </span>
            <span>{cityCode(shown.destination_city)}</span>
          </div>

          <span className="mt-2 truncate font-body text-[12px] tracking-wide text-muted">
            {airlineName(shown.airline)}
          </span>

          {/* fare — focal element */}
          <div className="mt-auto pt-5">
            <p className="font-data text-[10px] tracking-[0.3em] text-faint">
              {item.degraded ? "SIGNAL" : "FARE · INR"}
            </p>
            <p
              className="mt-1.5 font-data text-[30px] font-semibold leading-none tracking-tight tabular-nums sm:text-[32px]"
              style={{ color: item.degraded ? undefined : accent }}
            >
              {item.degraded ? (
                <span className="redacted-price">{"\u2593\u2593\u2593\u2593\u2593\u2593"}</span>
              ) : (
                <>
                  {arrow && (
                    <span
                      className="mr-1.5 align-[3px] text-[15px] font-bold"
                      style={{ opacity: 0.85 }}
                    >
                      {arrow}
                    </span>
                  )}
                  {formatPrice(shown.price)}
                </>
              )}
            </p>
          </div>

          {/* bottom row: duration + status */}
          <div className="mt-4 flex items-center justify-between font-data text-[11px] tracking-[0.12em]">
            <span className="flex items-center gap-1.5 text-muted">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1" />
                <path d="M5 2v3l2 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
              {formatDuration(shown.duration)}
            </span>
            {item.degraded ? (
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-[0.2em]"
                style={{
                  color: "var(--stalled)",
                  backgroundColor: "rgba(107, 119, 145, 0.14)",
                  border: "1px solid color-mix(in srgb, var(--stalled) 35%, transparent)",
                }}
              >
                STALLED
              </span>
            ) : pct !== null ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums tracking-[0.08em]"
                style={{
                  color: accent,
                  backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${accent} 38%, transparent)`,
                }}
              >
                {formatPct(shown.lastPct ?? 0)}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-muted/70">
                <span className="h-1.5 w-1.5 rounded-full bg-amber/70 animate-pulse-soft" />
                TRACKED
              </span>
            )}
          </div>
        </span>
      </motion.button>
    </motion.div>
  );
}