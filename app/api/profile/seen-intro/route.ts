import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/api-errors";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("profiles")
    .update({ has_seen_intro: true })
    .eq("id", user.id);

  if (error) return serverError(error, { route: "POST /api/profile/seen-intro", userId: user.id });
  return new NextResponse(null, { status: 204 });
}
