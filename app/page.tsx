import { RouteBoard } from "@/components/route-board";
import { getLatestByItem } from "@/lib/db";
import { toBoardItem } from "@/lib/types";

// Fare data changes between requests (poller writes while the app runs),
// so this route must always render at request time.
export const dynamic = "force-dynamic";

export default function Page() {
  const items = getLatestByItem().map(toBoardItem);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* ambient runway glow bleeding up from behind the board */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[560px]"
        style={{
          background:
            "radial-gradient(1100px 420px at 50% -160px, rgba(255,181,71,0.14), transparent 70%), radial-gradient(800px 360px at 85% 0%, rgba(255,107,128,0.07), transparent 70%), radial-gradient(800px 360px at 15% 0%, rgba(52,227,168,0.06), transparent 70%)",
        }}
      />

      {/* top branding bar */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-5 sm:px-6 lg:px-8">
        <span className="font-display text-xs font-semibold tracking-[0.35em] text-primary/90">
          FLIGHT<span className="text-amber">FARE</span>
        </span>
        <span className="font-data text-[10px] tracking-[0.3em] text-muted/60">
          DEPARTURE BOARD · INR · v2
        </span>
      </div>

      <RouteBoard initialItems={items} />
    </div>
  );
}