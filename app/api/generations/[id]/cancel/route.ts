import { NextRequest, NextResponse } from "next/server";
import { runs } from "@trigger.dev/sdk/v3";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CANCELLABLE_STATUSES = [
  "queued",
  "outlining",
  "researching",
  "drafting",
  "aggregating",
  "synthesizing",
];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Atomically claim the cancel: only one request flips an active status → canceling.
  // A concurrent resume that sees `canceling` will refuse to dispatch a new run.
  const { data: claimed } = await supabase
    .from("generations")
    .update({ status: "canceling" })
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", CANCELLABLE_STATUSES)
    .select("trigger_run_id")
    .maybeSingle();

  if (!claimed) {
    // Either the row doesn't exist (or isn't ours) or it's already terminal /
    // already canceling. Re-read to figure out which to return.
    const { data: existing } = await supabase
      .from("generations")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.status === "canceling") return NextResponse.json({ ok: true, status: "canceling" });
    return NextResponse.json({ error: "Generation is already in a terminal state" }, { status: 400 });
  }

  // Tell Trigger.dev to abort. If it fails (run not found, network blip), we
  // still mark canceled; the worker will be a no-op on its next checkpoint.
  if (claimed.trigger_run_id) {
    try {
      await runs.cancel(claimed.trigger_run_id);
    } catch {
      // Cancellation is best-effort upstream; DB state is the source of truth.
    }
  }

  await supabase
    .from("generations")
    .update({ status: "canceled" })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "canceling");

  return NextResponse.json({ ok: true });
}
