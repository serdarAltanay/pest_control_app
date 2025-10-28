// src/hooks/useHeartbeat.js
import { useEffect, useRef } from "react";
import api from "../api/axios";

/**
 * useHeartbeat
 * - enabled: true/false
 * - intervalMs: periyodik ping aralığı (ms)
 * - geoEnabled: konumu da ekle (çalışanlar için)
 *
 * Notlar:
 * - accessToken yoksa ping yapılmaz.
 * - 401/403 sonrası exponential backoff ile sessiz bekler.
 * - focus/visibility/online olaylarında token varsa ekstra ping atar.
 */
export default function useHeartbeat(enabled = true, intervalMs = 60_000, geoEnabled = false) {
  const timerRef = useRef(null);
  const lastPosRef = useRef(null);
  const watchIdRef = useRef(null);

  // 401/403 sonrası spam'ı kesmek için sessiz bekleme
  const failCountRef = useRef(0);
  const mutedUntilRef = useRef(0); // Date.now() millis

  useEffect(() => {
    if (!enabled) return;

    const hasToken = () => !!localStorage.getItem("accessToken");

    // --- GEO (yalnızca çalışanlarda) ---
    if (geoEnabled && "geolocation" in navigator) {
      // Son konumu güncel tut
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy, speed, heading } = pos.coords || {};
          lastPosRef.current = {
            lat,
            lng,
            accuracy: accuracy != null ? Math.round(accuracy) : undefined,
            speed: typeof speed === "number" ? speed : undefined,
            heading: typeof heading === "number" ? heading : undefined,
            at: Date.now(),
          };
        },
        () => {
          /* sessizce yoksay */
        },
        {
          enableHighAccuracy: false, // pil tasarrufu
          maximumAge: 60_000, // 1 dk cache
          timeout: 10_000,
        }
      );
    }

    const ping = async () => {
      // Token yoksa ya da mute süresi dolmadıysa deneme.
      if (!hasToken()) return;
      const now = Date.now();
      if (now < mutedUntilRef.current) return;
      if (!navigator.onLine) return;

      try {
        const payload = {};
        // Son konum çok eski değilse (<= 2 dk), isteğe ekle
        const p = lastPosRef.current;
        if (geoEnabled && p && now - p.at <= 120_000) {
          payload.lat = p.lat;
          payload.lng = p.lng;
          if (p.accuracy != null) payload.accuracy = p.accuracy;
          if (p.speed != null) payload.speed = p.speed;
          if (p.heading != null) payload.heading = p.heading;
        }

        await api.post(
          "/presence/heartbeat",
          Object.keys(payload).length ? payload : {},
          { headers: { "x-silent": "1" }, _isHeartbeat: true }
        );

        // Başarılı olduysa backoff sayaçlarını sıfırla
        failCountRef.current = 0;
        mutedUntilRef.current = 0;
      } catch (err) {
        // Sadece 401/403'te sessiz backoff uygula
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          failCountRef.current = Math.min(failCountRef.current + 1, 6); // tavan: 2^6=64s
          const waitMs = Math.min(1000 * 2 ** (failCountRef.current - 1), 60_000);
          mutedUntilRef.current = Date.now() + waitMs;
          // Not: refresh denemesi interceptor içinde yapılıyor;
          // burada sadece spam'i kesiyoruz.
        }
        // Diğer hataları sessizce geç
      }
    };

    // İlk ping: sadece token varsa
    if (hasToken()) ping();

    // Periyodik ping
    timerRef.current = setInterval(ping, intervalMs);

    // Tab görünür/odaklanınca ve internet gelince dene (token varsa)
    const onFocus = () => hasToken() && ping();
    const onVis = () => {
      if (document.visibilityState === "visible" && hasToken()) ping();
    };
    const onOnline = () => hasToken() && ping();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);

    // Diğer sekmeden login olursa (storage event), token gelince hızlı ping
    const onStorage = (e) => {
      if (e.key === "accessToken" && e.newValue) {
        // Muteyi sıfırla ve hemen ping at
        failCountRef.current = 0;
        mutedUntilRef.current = 0;
        ping();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      clearInterval(timerRef.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("storage", onStorage);
      if (watchIdRef.current != null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [enabled, intervalMs, geoEnabled]);
}
