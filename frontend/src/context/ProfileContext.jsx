// src/context/ProfileContext.jsx
import { createContext, useState, useEffect, useRef } from "react";
import axios from "axios";
import api from "../api/axios.js";
import { toast } from "react-toastify";
import { getAvatarUrl } from "../utils/getAssetUrl";

export const ProfileContext = createContext();

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const hbTimerRef = useRef(null);

  // Sessiz refresh (cookie varsa)
  const attemptRefresh = async () => {
    try {
      const r = await axios.post("/api/auth/refresh", {}, { withCredentials: true });
      const t = r?.data?.accessToken;
      if (t) {
        localStorage.setItem("accessToken", t);
        return true;
      }
    } catch {}
    return false;
  };

  // Profil çekme
  const fetchProfile = async () => {
    try {
      if (!localStorage.getItem("accessToken")) {
        const ok = await attemptRefresh();
        if (!ok) { setProfile(null); return; }
      }

      const { data } = await api.get("/profile", { headers: { "x-silent": "1" } });
      setProfile(data);

      // FE yönlendirme/durum için role + görsel bilgiler localStorage'a yazılsın
      const role = data?.role || "customer"; // AccessOwner ise "customer"
      localStorage.setItem("role", role);

      const fullName =
        data?.fullName ||
        [data?.firstName, data?.lastName].filter(Boolean).join(" ") ||
        data?.email || "";
      localStorage.setItem("fullName", fullName);
      localStorage.setItem("name", fullName);
      localStorage.setItem("email", data?.email || "");

      // AccessOwner iş rolü varsa cache’le
      if (data?.accessOwnerRole) {
        localStorage.setItem("accessOwnerRole", data.accessOwnerRole);
      } else {
        localStorage.removeItem("accessOwnerRole");
      }

      const absUrl = getAvatarUrl(data?.profileImage, { bust: true });
      localStorage.setItem("profileImage", absUrl);
    } catch (err) {
      if (err?.response?.status !== 401) {
        console.error("Profil yükleme hatası:", err);
        toast.error(
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Profil bilgisi alınamadı ❌"
        );
      }
      setProfile(null);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  // Heartbeat (presence) — mevcut route'ların değişmediğini varsayıyoruz
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token || !profile) return;

    if (hbTimerRef.current) clearInterval(hbTimerRef.current);

    const beat = async () => {
      try {
        // Not: backend’de presence/heartbeat varsa onu kullan, yoksa heartbeat/pulse'a çevir.
        await api.post("/presence/heartbeat", null, { headers: { "x-silent": "1" }, _isHeartbeat: true });
      } catch {
        // sessiz geç
      }
    };

    beat();
    hbTimerRef.current = setInterval(beat, 60_000);
    return () => { clearInterval(hbTimerRef.current); hbTimerRef.current = null; };
  }, [profile]);

  return (
    <ProfileContext.Provider value={{ profile, setProfile, fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}
