import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/auth/redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeRedirectPath(searchParams.get("next"));
  const authError = searchParams.get("error");
  const authErrorDescription = searchParams.get("error_description");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
    searchParams.set("error_description", error.message);
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", authError ?? "auth_failed");
  const description = authErrorDescription ?? searchParams.get("error_description");
  if (description) loginUrl.searchParams.set("error_description", description);
  loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}
