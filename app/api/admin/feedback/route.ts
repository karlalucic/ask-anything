import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin";

function csvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "json";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "500"), 1000);

  const serviceClient = createSupabaseServiceClient();
  const { data, error } = await serviceClient
    .from("feedback")
    .select("id, generation_id, user_id, rating, note, created_at, generations(topic, duration, voice)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (format === "csv") {
    const header = "id,generation_id,user_id,rating,note,created_at,topic,duration,voice\n";
    const rows = (data ?? []).map((r: Record<string, unknown>) => {
      const gen = r.generations as { topic?: string; duration?: string; voice?: string } | null;
      return [r.id, r.generation_id, r.user_id ?? "", r.rating, r.note ?? "", r.created_at, gen?.topic ?? "", gen?.duration ?? "", gen?.voice ?? ""].map(csvCell).join(",");
    }).join("\n");
    return new NextResponse(header + rows, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="feedback.csv"' },
    });
  }

  return NextResponse.json({ feedback: data });
}
