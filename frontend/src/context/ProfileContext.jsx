// ProfileContext.jsx
import { createContext, useState, useEffect, useRef } from "react";
import api from "../api/axios.js";
import { toast } from "react-toastify";

export const ProfileContext = createContext();

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const hbTimerRef = useRef(null); // <-- EKLENDİ

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) return;

      const res = await api.get("/profile");
      setProfile(res.data);
      localStorage.setItem("profileImage", res.data.profileImage || "/noavatar.jpg");
    } catch (err) {
      console.error("Profil yükleme hatası:", err);
      if (err.response?.status !== 401) {
        toast.error(err.response?.data?.error || "Profil bilgisi alınamadı ❌");
      }
    }
  };

  // --- Heartbeat başlat/durdur ---
  useEffect(() => {
    // profil varsa ve token varsa çalıştır
    if (profile && localStorage.getItem("accessToken")) {
      // varsa eskiyi temizle
      if (hbTimerRef.current) clearInterval(hbTimerRef.current);

      // hemen bir kere at
      api.post("/presence/heartbeat").catch(() => {});

      // 60 sn’de bir at
      hbTimerRef.current = setInterval(() => {
        api.post("/presence/heartbeat").catch(() => {});
      }, 60_000);
    }

    // cleanup
    return () => {
      if (hbTimerRef.current) {
        clearInterval(hbTimerRef.current);
        hbTimerRef.current = null;
      }
    };
  }, [profile]);

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, setProfile, fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}
