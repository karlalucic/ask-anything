"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function LogOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    posthog.capture("user_logged_out");
    posthog.reset();
    router.replace("/");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" type="button" onClick={handleLogout} disabled={loading}>
      <LogOut aria-hidden />
      {loading ? "Logging out" : "Log out"}
    </Button>
  );
}
