"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

/**
 * usePresence — live "builders on grid" counter via the presence mini-service.
 * Connects once per page (shared singleton socket), returns the live count.
 * SSR-safe: returns null until the first server push, so markup stays stable.
 */

let sharedSocket: Socket | null = null;
const listeners = new Set<(n: number | null) => void>();
let latest: number | null = null;

function getSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io("/?XTransformPort=3003", {
      path: "/",
      transports: ["websocket", "polling"],
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });
    sharedSocket.on("presence", (data: { count?: number }) => {
      if (typeof data?.count === "number") {
        latest = data.count;
        listeners.forEach((fn) => fn(latest));
      }
    });
    sharedSocket.on("connect_error", () => {
      /* stay silent — the HUD simply shows standby */
    });
  }
  return sharedSocket;
}

export function usePresence(): { online: number | null; connected: boolean } {
  const [online, setOnline] = useState<number | null>(latest);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    listeners.add(setOnline);

    const syncConnected = () => setConnected(socket.connected);
    queueMicrotask(syncConnected); // async initial sync — avoids sync setState in effect
    socket.on("connect", syncConnected);
    socket.on("disconnect", syncConnected);

    return () => {
      listeners.delete(setOnline);
      socket.off("connect", syncConnected);
      socket.off("disconnect", syncConnected);
      // singleton socket stays alive across mounts — intentional
    };
  }, []);

  return { online, connected };
}
