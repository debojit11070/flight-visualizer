import {
  getDegradedFlags,
  getMaxDeltaId,
  getRecentDeltas,
} from "@/lib/db";
import { runPollCycle } from "@/lib/poll-sim";

export const dynamic = "force-dynamic";

const TICK_MS = 4_000;

/**
 * Server-Sent Events feed. Each tick runs one poll cycle (today: the local
 * simulator; later: the Bright Data scraper — same tables either way), then
 * pushes any new delta rows to the browser.
 *
 * Event payloads:
 *   { type: "deltas", rows: DeltaRow[] }        — price changes to flip tiles
 *   { type: "state", degraded: Record<k, 0|1> } — sent only when flags change
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();

  let lastId = getMaxDeltaId();
  let lastFlags = JSON.stringify(getDegradedFlags());
  let interval: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // Client disconnected mid-write — stop ticking; cancel() handles cleanup.
          stop();
        }
      };

      const stop = () => {
        if (interval) clearInterval(interval);
        interval = undefined;
      };

      // Initial state so a freshly opened tab syncs immediately.
      send({ type: "state", degraded: JSON.parse(lastFlags) });

      interval = setInterval(() => {
        runPollCycle();

        const deltas = getRecentDeltas(lastId);
        if (deltas.length > 0) {
          lastId = Math.max(...deltas.map((d) => d.id));
          send({ type: "deltas", rows: deltas });
        }

        const flags = getDegradedFlags();
        const serialized = JSON.stringify(flags);
        if (serialized !== lastFlags) {
          lastFlags = serialized;
          send({ type: "state", degraded: flags });
        }
      }, TICK_MS);

      request.signal.addEventListener("abort", stop);
    },
    cancel() {
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
