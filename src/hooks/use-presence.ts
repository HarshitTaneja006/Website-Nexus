"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

/**
 * usePresence — live "builders on grid" counter powered by Supabase Realtime Presence.
 * Broadcasts and synchronizes active visitor counts globally with zero server overhead.
 */
export function usePresence(): { online: number | null; connected: boolean } {
  const [online, setOnline] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const sessionId = Math.random().toString(36).substring(2, 9);
    let supabase: ReturnType<typeof createClient> | null = null;

    try {
      if (
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ) {
        supabase = createClient();
      }
    } catch {
      // safe fallback
    }

    if (!supabase) {
      setOnline(1);
      setConnected(true);
      return;
    }

    const channel = supabase.channel("nexus-online-grid", {
      config: { presence: { key: sessionId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setOnline(Math.max(1, count));
      })
      .on("presence", { event: "join" }, () => {
        const state = channel.presenceState();
        setOnline(Math.max(1, Object.keys(state).length));
      })
      .on("presence", { event: "leave" }, () => {
        const state = channel.presenceState();
        setOnline(Math.max(1, Object.keys(state).length));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          await channel.track({ online_at: new Date().toISOString() });
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setConnected(false);
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, []);

  return { online: online ?? 1, connected };
}

