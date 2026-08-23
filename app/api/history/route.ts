import {
  getHistoryForItem,
  getRecentDeltasForItem,
} from "@/lib/db";

export const dynamic = "force-dynamic";

/** Snapshot history + recent deltas for one route tile (drawer content). */
export async function GET(request: Request) {
  const itemKey = new URL(request.url).searchParams.get("item_key");

  if (!itemKey) {
    return Response.json({ error: "item_key is required" }, { status: 400 });
  }

  const history = getHistoryForItem(itemKey);
  const deltas = getRecentDeltasForItem(itemKey, 5);

  return Response.json({ history, deltas });
}
