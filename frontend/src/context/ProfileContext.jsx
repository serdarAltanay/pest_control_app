// src/context/ProfileContext.jsx
import { createContext, useState, useEffect, useRef } from "react";
import api from "../api/axios.js";
import { toast } from "react-toastify";
import { getAvatarUrl, addCacheBust } from "../utils/getAssetUrl"; // ✅ EKLENDİ

export const ProfileContext = createContext();

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const hbTimerRef = useRef(null);

  // localStorage'a her zaman MUTLAK url yaz (getAvatarUrl bunu garanti eder)
  const cacheAvatar = (rawPath) => {
    const absUrl = getAvatarUrl(rawPath, {bust:true});      // uploads/... -> http://localhost:5000/uploads/...
    localStorage.setItem("profileImage", absUrl); // cache-bust ile taze görüntü
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) return;

      const res = await api.get("/profile");
      setProfile(res.data);
      cacheAvatar(res.data.profileImage);      // ✅ eskisi: localStorage.setItem("profileImage", res.data.profileImage || "/noavatar.jpg");
    } catch (err) {
      console.error("Profil yükleme hatası:", err);
      if (err.response?.status !== 401) {
        toast.error(err.response?.data?.error || "Profil bilgisi alınamadı ❌");
      }
    }
  };

  // Heartbeat
  useEffect(() => {
    if (profile && localStorage.getItem("accessToken")) {
      if (hbTimerRef.current) clearInterval(hbTimerRef.current);
      api.post("/presence/heartbeat").catch(() => {});
      hbTimerRef.current = setInterval(() => {
        api.post("/presence/heartbeat").catch(() => {});
      }, 60_000);
    }
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
