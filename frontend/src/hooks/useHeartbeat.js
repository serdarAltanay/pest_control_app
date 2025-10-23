// src/hooks/useHeartbeat.js
import { useEffect, useRef } from "react";
import api from "../api/axios";

export default function useHeartbeat(enabled = true, intervalMs = 60_000, geoEnabled = false) {
  const timerRef = useRef(null);
  const lastPosRef = useRef(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    // --- GEO (yalnızca çalışanlarda) ---
    if (geoEnabled && "geolocation" in navigator) {
      // Son konumu güncel tut
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy, speed, heading } = pos.coords || {};
          lastPosRef.current = {
            lat, lng,
            accuracy: accuracy != null ? Math.round(accuracy) : undefined,
            speed: typeof speed === "number" ? speed : undefined,
            heading: typeof heading === "number" ? heading : undefined,
            at: Date.now(),
          };
        },
        () => { /* sessizce yoksay */ },
        {
          enableHighAccuracy: false, // pil tasarrufu
          maximumAge: 60_000,        // 1 dk cache
          timeout: 10_000,
        }
      );
    }

    const ping = async () => {
      try {
        const payload = {};
        // Son konum çok eski değilse (<= 2 dk), isteğe ekle
        const p = lastPosRef.current;
        if (geoEnabled && p && Date.now() - p.at <= 120_000) {
          payload.lat = p.lat;
          payload.lng = p.lng;
          if (p.accuracy != null) payload.accuracy = p.accuracy;
          if (p.speed != null) payload.speed = p.speed;
          if (p.heading != null) payload.heading = p.heading;
        }

        await api.post(
          "/presence/heartbeat",
          Object.keys(payload).length ? payload : null,
          { headers: { "x-silent": "1" }, _isHeartbeat: true }
        ).catch(() => {});
      } catch {}
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
      if (watchIdRef.current != null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [enabled, intervalMs, geoEnabled]);
}
