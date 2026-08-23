import { setDegraded } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Demo control for the self-healing sequence: flip an item's degraded flag
 * and watch the tile stall / heal on the board. In production this flag is
 * written by the poller when a scrape fails, cleared by `scraper heal`.
 */
export async function POST(request: Request) {
  let body: { item_key?: string; degraded?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { item_key, degraded } = body;
  if (typeof item_key !== "string" || typeof degraded !== "boolean") {
    return Response.json(
      { error: "Expected { item_key: string, degraded: boolean }" },
      { status: 400 }
    );
  }

  try {
    const value = setDegraded(item_key, degraded);
    return Response.json({ item_key, degraded: value });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 404 }
    );
  }
}
