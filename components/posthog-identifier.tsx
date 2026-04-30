"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function PostHogIdentifier() {
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function syncInitial() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session?.user) return;
      if (posthog.get_distinct_id() !== session.user.id) {
        posthog.identify(session.user.id, { email: session.user.email });
      }
    }

    syncInitial();

    const { data: sub } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === "SIGNED_OUT") {
        posthog.reset();
        return;
      }
      if (session?.user && posthog.get_distinct_id() !== session.user.id) {
        posthog.identify(session.user.id, { email: session.user.email });
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return null;
}
