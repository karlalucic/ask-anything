import { NextRequest, NextResponse } from "next/server";
import { runs } from "@trigger.dev/sdk/v3";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: gen } = await supabase
    .from("generations")
    .select("trigger_run_id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!gen) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const terminalStatuses = ["complete", "failed", "canceled"];
  if (terminalStatuses.includes(gen.status)) {
    return NextResponse.json({ error: "Generation is already in a terminal state" }, { status: 400 });
  }

  if (gen.trigger_run_id) {
    try {
      await runs.cancel(gen.trigger_run_id);
    } catch {
      // If Trigger.dev cancel fails, continue to mark as canceled in DB
    }
  }

  await supabase
    .from("generations")
    .update({ status: "canceled" })
    .eq("id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
