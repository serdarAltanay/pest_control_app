// src/hooks/useHeartbeat.js
import { useEffect, useRef } from "react";
import api from "../api/axios";

export default function useHeartbeat(enabled = true, intervalMs = 60_000) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const ping = async () => {
      // örn. useHeartbeat içinde:
            await api.post(
            "/presence/heartbeat",
            null,
            { headers: { "x-silent": "1" }, _isHeartbeat: true }
            ).catch(() => {});

    };

    // anında bir kere
    ping();

    // periyodik
    timerRef.current = setInterval(ping, intervalMs);

    // tab görünür/odaklanınca bir ping
    const onFocus = () => ping();
    const onVis = () => { if (document.visibilityState === "visible") ping(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onFocus);

    return () => {
      clearInterval(timerRef.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onFocus);
    };
  }, [enabled, intervalMs]);
}
