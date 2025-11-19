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

    // ESLint: no-restricted-globals → 'location' yerine window.location kullan
    const host =
      typeof window !== "undefined" && window.location
        ? window.location.hostname
        : "";
    const secureContext =
      typeof window !== "undefined" && "isSecureContext" in window
        ? window.isSecureContext
        : false;
    const secureOk = secureContext || host === "localhost";

    // --- GEO (yalnızca çalışanlarda) ---
    if (geoEnabled && "geolocation" in navigator) {
      // İlk değer hızlı dolsun diye: tek seferlik currentPosition
      if (secureOk) {
        navigator.geolocation.getCurrentPosition(
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
            if (process.env.NODE_ENV !== "production") {
              console.log("[heartbeat] first position:", lastPosRef.current);
            }
          },
          (err) => {
            if (process.env.NODE_ENV !== "production") {
              console.warn("[heartbeat] getCurrentPosition error:", err?.code, err?.message);
              if (!secureOk) console.warn("[heartbeat] Geolocation için HTTPS şart (ya da localhost).");
            }
          },
          { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 }
        );
      }

      // Sürekli izleme
      if (secureOk) {
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
          (err) => {
            // Hata sebebini görün: permission denied / insecure context / timeout…
            if (process.env.NODE_ENV !== "production") {
              console.warn("[heartbeat] watchPosition error:", err?.code, err?.message);
              if (!secureOk) console.warn("[heartbeat] Geolocation için HTTPS şart (ya da localhost).");
            }
          },
          {
            enableHighAccuracy: false, // pil tasarrufu
            maximumAge: 60_000,        // 1 dk cache
            timeout: 10_000,
          }
        );
      } else {
        // Güvensiz bağlamda (localhost hariç) konum üretmeyiz
        if (process.env.NODE_ENV !== "production") {
          console.warn("[heartbeat] Insecure context: konum verisi gönderilmeyecek.");
        }
      }
    }

    const ping = async () => {
      if (!hasToken()) return;
      const now = Date.now();
      if (now < mutedUntilRef.current) return;
      if (!navigator.onLine) return;

      try {
        const payload = {};
        // Son konum çok eski değilse (<= 2 dk), isteğe ekle
        const p = lastPosRef.current;
        if (geoEnabled && p && now - p.at <= 120_000) {
          // NaN/Infinity guard
          if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
            payload.lat = p.lat;
            payload.lng = p.lng;
          }
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
        }
        // Diğer hataları sessizce geç
      }
    };

    // İlk ping (token varsa)
    if (hasToken()) ping();

    // Periyodik ping
    timerRef.current = setInterval(ping, intervalMs);

    // Tab görünür/odaklanınca ve internet gelince dene (token varsa)
    const onFocus = () => hasToken() && ping();
    const onVis = () => { if (document.visibilityState === "visible" && hasToken()) ping(); };
    const onOnline = () => hasToken() && ping();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);

    // Diğer sekmeden login olursa (storage event), token gelince hızlı ping
    const onStorage = (e) => {
      if (e.key === "accessToken" && e.newValue) {
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
