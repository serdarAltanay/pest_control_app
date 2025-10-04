import { useEffect, useRef } from "react";
import api from "../api/axios";

// kaç sn'de bir ping atalım?
const INTERVAL_MS = 60 * 1000;

// basit debouncer
const now = () => new Date().getTime();

export default function useHeartbeat(enabled = true) {
  const lastPingRef = useRef(0);
  const intervalRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const ping = async () => {
      // sekme görünür değilken ping atmayalım
      if (document.visibilityState !== "visible") return;
      const t = now();
      if (t - lastPingRef.current < 10 * 1000) return; // 10 sn altı talepleri yut
      lastPingRef.current = t;

      try {
        await api.post("/presence/heartbeat"); // auth header zaten axios instance’da
      } catch (e) {
        // sessiz geç; heartbeat kritik değil
        // console.debug("heartbeat fail", e?.message);
      }
    };

    // ilk açılışta hemen bir ping
    ping();

    // düzenli ping
    intervalRef.current = setInterval(ping, INTERVAL_MS);

    // görünürlük değişince ping
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);

    // sayfadan ayrılırken beacon — CORS/credentials uygun olmalı
    const onLeave = () => {
      try {
        // sendBeacon form-data / blob ile daha stabil
        const url = `${import.meta.env.VITE_API_BASE_URL || ""}/presence/heartbeat`;
        const token = localStorage.getItem("accessToken");
        // Token'ı beacon ile header'a koyamayız — çoğu sunucu cookie ile çalışır.
        // Eğer sadece cookie ile refresh tasarlamadıysan bunu atlayabilirsin.
        // Alternatif: kısa süreli fetch({ keepalive: true }) — modern tarayıcılar destekler.
        if (token && navigator.sendBeacon) {
          const blob = new Blob(
            [JSON.stringify({ via: "beacon" })],
            { type: "application/json" }
          );
          // NOT: Header ekleyemediği için backend auth cookie bekliyorsa çalışır,
          // Bearer token gerekiyorsa fetch keepalive kullan:
          navigator.sendBeacon(url, blob);
        } else if (token && typeof fetch === "function") {
          fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ via: "keepalive" }),
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}
    };
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [enabled]);
}
